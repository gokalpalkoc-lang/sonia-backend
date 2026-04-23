import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/theme-context';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';

type Detection = {
  name: string;
  emotion: string;
  raw_emotion: string;
  confidence: number;
  emotion_confidence: number;
  box: [number, number, number, number]; // top, right, bottom, left
};

/** Map a raw (English) emotion to a display colour. */
function emotionColour(raw: string): string {
  if (['fear', 'sad', 'angry', 'disgust'].includes(raw)) return '#F87171'; // red
  if (['neutral', 'surprise'].includes(raw)) return '#FBBF24';              // amber
  if (raw === 'happy') return '#4ADE80';                                     // green
  return 'rgba(255,255,255,0.5)';                                            // unknown
}

export default function CameraDetectScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();

  // Safe back navigation: go back if possible, otherwise go to carousel
  const goBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/carousel' as any);
    }
  };

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  // Use a ref for the processing guard to avoid stale closure issues (Bug 2 fix)
  const isProcessingRef = useRef(false);
  // Separate display state for the spinner
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    // Bug 1 fix: interval is set up once (permission in deps only) and never torn down by state changes
    if (!permission?.granted) return;

    const processFrame = async () => {
      if (!cameraRef.current || isProcessingRef.current) return;

      try {
        isProcessingRef.current = true;
        setShowSpinner(true);

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          base64: true,
          shutterSound: false,
        });

        if (photo?.base64) {
          const response = await apiFetch('/api/analyze-frame', {
            method: 'POST',
            body: JSON.stringify({ image_base64: photo.base64 }),
          });

          // Feature E: graceful 401 handling
          if (response.status === 401) {
            Alert.alert(
              'Oturum Süresi Doldu',
              'Lütfen tekrar giriş yapın.',
              [{ text: 'Tamam', onPress: () => { logout(); router.replace('/'); } }]
            );
            return;
          }

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.detections) {
              // Feature 5: server now handles temporal smoothing, use smoothed_emotion directly
              setDetections(data.detections);
            }
          }
        }
      } catch (error) {
        console.warn('Error processing frame:', error);
      } finally {
        isProcessingRef.current = false;
        setShowSpinner(false);
      }
    };

    const interval = setInterval(processFrame, 3000);
    return () => clearInterval(interval);
  }, [permission]); // Bug 1 fix: removed isProcessing from deps

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
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.surface, marginTop: 10 }]} onPress={() => goBack()}>
          <Text style={[styles.buttonText, { color: colors.text }]}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <CameraView style={styles.camera} facing="front" ref={cameraRef} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, position: 'absolute', top: 0, left: 0, right: 0 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBack()}
          activeOpacity={0.7}
        >
          <Text style={[styles.backText, { color: colors.text }]}>‹ Geri</Text>
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          {showSpinner
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.badgeText}>Yüz Tanıma Aktif</Text>
          }
        </View>
      </View>

      {/* Detections Overlay */}
      <View style={[styles.overlay, { position: 'absolute', bottom: 0, left: 0, right: 0 }]}>
        {detections.length === 0 && !showSpinner && (
          <Text style={styles.statusText}>Yüz aranıyor...</Text>
        )}
        {detections.map((det, index) => {
          // Feature 5: use server-side smoothed emotion for colour
          const smoothed = (det as any).smoothed_emotion || det.raw_emotion;
          const colour = emotionColour(smoothed);
          const quality = (det as any).face_quality;
          return (
            <View key={index} style={styles.detectionCard}>
              <Text style={styles.nameText}>{det.name}</Text>
              {/* Bug 9 fix: dynamic emotion colour */}
              <Text style={[styles.emotionText, { color: colour }]}>
                {det.emotion}
              </Text>
              {/* Feature C: confidence badge */}
              {det.emotion_confidence > 0 && (
                <View style={styles.confRow}>
                  <View style={[styles.confBar, { width: `${Math.round(det.emotion_confidence)}%` as any, backgroundColor: colour }]} />
                  <Text style={styles.confText}>{Math.round(det.emotion_confidence)}%</Text>
                </View>
              )}
              {/* Feature 8: face quality warning */}
              {quality && quality.score < 50 && quality.issues?.length > 0 && (
                <Text style={styles.qualityWarn}>⚠ {quality.issues[0]}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    minWidth: 44,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  detectionCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    minWidth: 220,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  nameText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emotionText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  // Feature C: confidence bar
  confRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confBar: {
    height: 4,
    borderRadius: 2,
    minWidth: 4,
  },
  confText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  // Feature 8: face quality warning
  qualityWarn: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
