import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, TextInput, Pressable,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/theme-context';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'face-register' | 'emotions';

interface FaceEntry {
  name: string;
  filename: string;
  size_kb: number;
}

const EMOTIONS = [
  { id: 'neutral',  label: 'Nötr' },
  { id: 'happy',    label: 'Mutlu' },
  { id: 'sad',      label: 'Üzgün' },
  { id: 'fear',     label: 'Korkmuş' },
  { id: 'angry',    label: 'Kızgın' },
  { id: 'disgust',  label: 'İğrenmiş' },
  { id: 'surprise', label: 'Şaşkın' },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EmotionSetupScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  // Bug 4 fix: derive person_name from the logged-in user's profile
  const personName = profile?.patient_name?.trim() || profile?.username || 'Bilinmeyen Kişi';

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // ── Step management ──────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('face-register');

  // ── Face registration state ──────────────────────────────────────────────
  const [nameInput, setNameInput] = useState(personName);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [faces, setFaces] = useState<FaceEntry[]>([]);
  const [facesLoading, setFacesLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  // Safe back navigation: go back if possible, otherwise go to carousel
  const goBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/carousel' as any);
    }
  };

  // ── Emotion calibration state ────────────────────────────────────────────
  const [selectedEmotion, setSelectedEmotion] = useState(EMOTIONS[0].id);
  const [calibrated, setCalibrated] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  // Feature 1: multi-sample progress (0 = idle, 1-3 = capturing sample N)
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const CALIBRATION_SAMPLES = 3;

  // ── Load registered faces ────────────────────────────────────────────────
  const loadFaces = useCallback(async () => {
    try {
      setFacesLoading(true);
      const res = await apiFetch(`/api/faces?t=${Date.now()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.faces)) {
        setFaces(data.faces);
        if (data.faces.length > 0) {
          setFaceRegistered(true);
        } else {
          setFaceRegistered(false);
        }
      }
    } catch {
      /* non-critical */
    } finally {
      setFacesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFaces();
  }, [loadFaces]);

  // Feature D: load already-calibrated emotions on mount
  useEffect(() => {
    if (!personName || personName === 'Bilinmeyen Kişi') return;

    apiFetch(`/api/calibration-status?person_name=${encodeURIComponent(personName)}&t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.calibrated)) {
          const map: Record<string, boolean> = {};
          data.calibrated.forEach((key: string) => { map[key] = true; });
          setCalibrated(map);

          // If all emotions done, face was already registered — skip face step
          if (data.calibrated.length > 0) {
            setFaceRegistered(true);
          }
        }
      })
      .catch(() => { /* non-critical */ });
  }, [personName]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const captureAndRegisterFace = async () => {
    if (!cameraRef.current || isProcessing) return;
    const nameToRegister = nameInput.trim() || personName;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
        shutterSound: true,
      });

      if (!photo?.base64) return;

      const response = await apiFetch('/api/register-face', {
        method: 'POST',
        body: JSON.stringify({
          image_base64: photo.base64,
          name: nameToRegister,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Yüz Kaydedildi', `${nameToRegister} için yüz başarıyla kaydedildi!`);
        setFaceRegistered(true);
        loadFaces(); // Refresh the face list
        setStep('emotions');
      } else {
        Alert.alert('Hata', data.message || data.error || 'Yüz kaydedilemedi.');
      }
    } catch (error: any) {
      Alert.alert('Bağlantı Hatası', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteFace = async (face: FaceEntry) => {
    // Promise-based confirmation to avoid async callback loss in Alert
    const confirmed = await new Promise<boolean>(resolve => {
      Alert.alert(
        'Yüzü Sil',
        `"${face.name}" - "${face.filename}" silinsin mi?`,
        [
          { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Sil', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

    if (!confirmed) return;

    try {
      setDeletingFile(face.filename);
      const res = await apiFetch('/api/faces/delete', {
        method: 'POST',
        body: JSON.stringify({ filename: face.filename }),
      });
      const data = await res.json();
      if (data.success) {
        await loadFaces();
      } else {
        Alert.alert('Hata', data.message || 'Dosya silinemedi.');
      }
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Bağlantı hatası.');
    } finally {
      setDeletingFile(null);
    }
  };

  const captureCalibration = async () => {
    if (!cameraRef.current || isProcessing) return;
    const nameToUse = nameInput.trim() || personName;

    try {
      setIsProcessing(true);

      // Feature 1: capture multiple photos for averaged calibration
      const photos: string[] = [];
      for (let i = 0; i < CALIBRATION_SAMPLES; i++) {
        setCalibrationProgress(i + 1);
        // Small delay between shots for different micro-expressions
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        const photo = await cameraRef.current!.takePictureAsync({
          quality: 0.5,
          base64: true,
          shutterSound: true,
        });
        if (photo?.base64) {
          photos.push(photo.base64);
        }
      }

      setCalibrationProgress(0);

      if (photos.length === 0) {
        Alert.alert('Hata', 'Fotoğraf çekilemedi.');
        return;
      }

      const response = await apiFetch('/api/calibrate-emotion', {
        method: 'POST',
        body: JSON.stringify({
          image_base64_list: photos,
          emotion: selectedEmotion,
          person_name: nameToUse,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const samplesMsg = data.samples_used ? ` (${data.samples_used} örnek)` : '';
        Alert.alert('Başarılı', `${EMOTIONS.find(e => e.id === selectedEmotion)?.label} ifadesi kalibre edildi!${samplesMsg}`);
        setCalibrated(prev => ({ ...prev, [selectedEmotion]: true }));

        // Auto-select next uncalibrated emotion
        const currentIndex = EMOTIONS.findIndex(e => e.id === selectedEmotion);
        if (currentIndex < EMOTIONS.length - 1) {
          setSelectedEmotion(EMOTIONS[currentIndex + 1].id);
        }
      } else {
        Alert.alert('Hata', data.message || data.error || 'Kalibrasyon başarısız oldu.');
      }
    } catch (error: any) {
      Alert.alert('Bağlantı Hatası', error.message);
    } finally {
      setIsProcessing(false);
      setCalibrationProgress(0);
    }
  };

  // ── Permission screens ────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text, marginBottom: 20 }}>Kamera izni gerekiyor.</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={requestPermission}>
          <Text style={styles.buttonText}>İzin Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.surface, marginTop: 10 }]} onPress={() => router.replace('/carousel' as any)}>
          <Text style={[styles.buttonText, { color: colors.text }]}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const calibratedCount = Object.values(calibrated).filter(Boolean).length;

  // Group faces by person name for display
  const facesByPerson: Record<string, FaceEntry[]> = {};
  faces.forEach(f => {
    if (!facesByPerson[f.name]) facesByPerson[f.name] = [];
    facesByPerson[f.name].push(f);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBack()} activeOpacity={0.7}>
          <Text style={[styles.backText, { color: colors.text }]}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {step === 'face-register' ? 'Yüz Kaydı' : 'Duygu Kalibrasyonu'}
        </Text>
        {/* Step indicator */}
        <View style={[styles.stepBadge, { backgroundColor: colors.surface }]}>
          <Text style={[styles.stepBadgeText, { color: colors.textSecondary }]}>
            {step === 'face-register' ? '1/2' : '2/2'}
          </Text>
        </View>
      </View>

      {/* Step tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.tab, step === 'face-register' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
          onPress={() => setStep('face-register')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: step === 'face-register' ? colors.accent : colors.textSecondary }]}>
            📷 Yüz Kaydı {faceRegistered ? '✓' : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, step === 'emotions' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
          onPress={() => setStep('emotions')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: step === 'emotions' ? colors.accent : colors.textSecondary }]}>
            🎭 Duygular {calibratedCount > 0 ? `(${calibratedCount}/${EMOTIONS.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="front" ref={cameraRef} />
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>
              {calibrationProgress > 0
                ? `Fotoğraf ${calibrationProgress}/${CALIBRATION_SAMPLES} çekiliyor...`
                : 'İşleniyor...'}
            </Text>
          </View>
        )}
      </View>

      {/* ── Step 1: Face Registration ────────────────────────────────────── */}
      {step === 'face-register' && (
        <View style={[styles.controlsContainer, { backgroundColor: colors.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }} nestedScrollEnabled>
            <Text style={[styles.instruction, { color: colors.textSecondary }]}>
              Hastanın yüzü kameraya bakacak şekilde konumlandırın ve kaydedin.
              Bu bilgi, yüz tanımada kullanılacak.
            </Text>

            {/* Name input */}
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Hasta Adı</Text>
            <TextInput
              style={[styles.nameInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Hasta adını girin"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.captureButton, { backgroundColor: colors.accent, opacity: isProcessing ? 0.7 : 1, marginTop: 16 }]}
              onPress={captureAndRegisterFace}
              disabled={isProcessing}
            >
              <Text style={styles.captureButtonText}>📷 Yüzü Kaydet</Text>
            </TouchableOpacity>

            {faceRegistered && (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.accent, marginTop: 10 }]}
                onPress={() => setStep('emotions')}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>
                  Duygu Kalibrasyonuna Geç →
                </Text>
              </TouchableOpacity>
            )}

            {/* ── Registered Faces List ── */}
            {faces.length > 0 && (
              <View style={styles.facesSection}>
                <Text style={[styles.facesSectionTitle, { color: colors.text }]}>
                  Kayıtlı Yüzler ({faces.length})
                </Text>
                {Object.entries(facesByPerson).map(([pName, personFaces]) => (
                  <View key={pName} style={styles.personGroup}>
                    <View style={styles.personHeader}>
                      <View style={[styles.personAvatar, { backgroundColor: colors.accentLight || colors.accent + '22' }]}>
                        <Text style={[styles.personAvatarText, { color: colors.accent }]}>
                          {pName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.personName, { color: colors.text }]}>
                        {pName}
                      </Text>
                      <View style={[styles.faceBadge, { backgroundColor: colors.accent + '22' }]}>
                        <Text style={[styles.faceBadgeText, { color: colors.accent }]}>
                          {personFaces.length} fotoğraf
                        </Text>
                      </View>
                    </View>
                    {personFaces.map((face) => (
                      <View key={face.filename} style={[styles.faceRow, { backgroundColor: colors.background }]}>
                        <View style={styles.faceInfo}>
                          <Text style={[styles.faceFilename, { color: colors.text }]}>
                            {face.filename}
                          </Text>
                          <Text style={[styles.faceSize, { color: colors.textMuted }]}>
                            {face.size_kb} KB
                          </Text>
                        </View>
                        <Pressable
                          style={({ pressed }) => [styles.deleteButton, { opacity: pressed || deletingFile === face.filename ? 0.5 : 1 }]}
                          onPress={() => handleDeleteFace(face)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          disabled={deletingFile === face.filename}
                        >
                          {deletingFile === face.filename
                            ? <ActivityIndicator size="small" color="#EF4444" />
                            : <Text style={styles.deleteButtonText}>🗑️</Text>
                          }
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
            {facesLoading && (
              <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 12 }} />
            )}
          </ScrollView>
        </View>
      )}

      {/* ── Step 2: Emotion Calibration ──────────────────────────────────── */}
      {step === 'emotions' && (
        <View style={[styles.controlsContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.instruction, { color: colors.textSecondary }]}>
            Seçili ifadeyi yüzünüzde canlandırıp çekim yapın.{'\n'}
            <Text style={{ color: colors.accent, fontWeight: '600' }}>{nameInput.trim() || personName}</Text> için kalibrasyon.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.emotionScroll}
            contentContainerStyle={styles.emotionScrollContent}
          >
            {EMOTIONS.map(emotion => {
              const isSelected = selectedEmotion === emotion.id;
              const isDone = calibrated[emotion.id];

              return (
                <TouchableOpacity
                  key={emotion.id}
                  style={[
                    styles.emotionPill,
                    { backgroundColor: isSelected ? colors.accent : (isDone ? '#10B981' : colors.background) },
                    isSelected && styles.emotionPillSelected,
                  ]}
                  onPress={() => setSelectedEmotion(emotion.id)}
                >
                  <Text style={[styles.emotionPillText, { color: (isSelected || isDone) ? '#fff' : colors.text }]}>
                    {emotion.label} {isDone ? '✓' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.captureButton, { backgroundColor: colors.accent, opacity: isProcessing ? 0.7 : 1 }]}
            onPress={captureCalibration}
            disabled={isProcessing}
          >
            <Text style={styles.captureButtonText}>
              {EMOTIONS.find(e => e.id === selectedEmotion)?.label} İfadesini Kaydet
            </Text>
          </TouchableOpacity>

          {calibratedCount === EMOTIONS.length && (
            <View style={[styles.completeBanner, { backgroundColor: '#10B981' + '22', borderColor: '#10B981' }]}>
              <Text style={{ color: '#10B981', fontWeight: '700', textAlign: 'center' }}>
                ✓ Tüm duygular kalibre edildi!
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(100,100,100,0.2)',
    borderRadius: 20,
  },
  backText: { fontSize: 16, fontWeight: '600' },
  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stepBadgeText: { fontSize: 13, fontWeight: '600' },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '600' },

  // Camera
  cameraContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: { flex: 1 },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: { color: '#fff', marginTop: 10, fontSize: 16, fontWeight: '600' },

  // Controls
  controlsContainer: {
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 12,
  },
  instruction: { fontSize: 13, textAlign: 'center', marginBottom: 14, lineHeight: 20 },

  // Face registration
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },

  // Registered faces list
  facesSection: {
    marginTop: 20,
  },
  facesSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  personGroup: {
    marginBottom: 14,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  personAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  personAvatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  faceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  faceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  faceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
    marginLeft: 42,
  },
  faceInfo: {
    flex: 1,
  },
  faceFilename: {
    fontSize: 13,
    fontWeight: '500',
  },
  faceSize: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteButtonText: {
    fontSize: 16,
  },

  // Emotion pills
  emotionScroll: { flexGrow: 0, marginBottom: 18 },
  emotionScrollContent: { gap: 10, paddingHorizontal: 4 },
  emotionPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(100,100,100,0.2)',
  },
  emotionPillSelected: { borderColor: 'transparent', transform: [{ scale: 1.05 }] },
  emotionPillText: { fontSize: 14, fontWeight: '600' },

  // Buttons
  captureButton: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  captureButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
  button: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Complete banner
  completeBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
