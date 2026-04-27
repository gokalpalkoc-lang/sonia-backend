import { AudioModule, RecordingPresets, useAudioRecorder } from "expo-audio";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";
import { apiFetchForm } from "@/lib/api";
import { setVoiceId } from "@/lib/storage";

const RECORD_DURATION = 30; // seconds
const URI_WAIT_TIMEOUT_MS = 2500;
const URI_POLL_INTERVAL_MS = 100;

type Phase = "idle" | "recording" | "uploading" | "done";

export default function VoiceSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { refreshProfile } = useAuth();
  const { colors } = useTheme();

  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(RECORD_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAndUploadRef = useRef<() => Promise<void>>(async () => {});

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const waitForRecordingUri = useCallback(async () => {
    const deadline = Date.now() + URI_WAIT_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (recorder.uri) {
        return recorder.uri;
      }
      await new Promise((resolve) => setTimeout(resolve, URI_POLL_INTERVAL_MS));
    }

    return recorder.uri;
  }, [recorder]);

  const startRecording = useCallback(async () => {
    // Request microphone permission
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
      Alert.alert(
        "Permission Required",
        "Microphone access required to clone your voice. .",
      );
      return;
    }

    try {
      setCountdown(RECORD_DURATION);
      await recorder.prepareToRecordAsync();
      await recorder.record();
      setPhase("recording");
    } catch (error) {
      console.error("Recording start failed:", error);
      Alert.alert("Error", "Recording wasn't successful. Please try again.");
      setPhase("idle");
      return;
    }

    // 30-second countdown
    let remaining = RECORD_DURATION;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        void stopAndUploadRef.current();
      }
    }, 1000);
  }, [recorder]);

  const stopAndUpload = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop recording
    try {
      await recorder.stop();
    } catch (error) {
      console.error("Recording stop failed:", error);
      Alert.alert("Error", "Recording wasn't successful. Please try again.");
      setPhase("idle");
      return;
    }
    setPhase("uploading");

    const uri = await waitForRecordingUri();
    if (!uri) {
      Alert.alert("Error", "Recording was failed — voice file couldn't be created.");
      setPhase("idle");
      return;
    }

    try {
      // Build multipart form data
      const formData = new FormData();
      if (Platform.OS === "web") {
        const blobRes = await fetch(uri);
        const blob = await blobRes.blob();
        formData.append("audio", blob, "voice-sample.m4a");
      } else {
        formData.append("audio", {
          uri,
          type: "audio/m4a",
          name: "voice-sample.m4a",
        } as any);
      }
      formData.append("name", "Sonia User Voice");

      const response = await apiFetchForm('/api/voice-clone', {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success && data.voiceId) {
        // Store voice ID locally and in the backend profile
        await setVoiceId(data.voiceId);
        await refreshProfile();
        setPhase("done");

        // Small delay so user sees the success state, then navigate
        setTimeout(() => {
          router.replace("/carousel");
        }, 1200);
      } else {
        Alert.alert(
          "Cloning failed",
          data.error || "There was an error with cloning your voice..",
        );
        setPhase("idle");
      }
    } catch (error) {
      console.error("Voice clone upload error:", error);
      Alert.alert(
        "Connection Error",
        "Couldn't access the server. Please check your connection and try again.",
      );
      setPhase("idle");
    }
  }, [recorder, router, waitForRecordingUri, refreshProfile]);
  useEffect(() => {
    stopAndUploadRef.current = stopAndUpload;
  }, [stopAndUpload]);

  // Progress ratio for the circular indicator
  const progress = 1 - countdown / RECORD_DURATION;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, backgroundColor: colors.background }]}>
      {/* Title */}
      <Text style={[styles.title, { color: colors.text }]}>Voice Setup</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Record your voice for 30 seconds in order for us to create you an artifical intelligence voice clone.
      </Text>

      {/* Center area */}
      <View style={styles.center}>
        {phase === "idle" && (
          <>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={startRecording}
              activeOpacity={0.75}
            >
              <Text style={styles.micIcon}>🎙️</Text>
            </TouchableOpacity>
            <Text style={[styles.hint, { color: colors.textMuted }]}>Click to start recording</Text>
          </>
        )}

        {phase === "recording" && (
          <>
            {/* Pulsing ring + countdown */}
            <View style={styles.recordingRing}>
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
            <Text style={styles.recordingLabel}>Saving…</Text>
            {/* Progress bar */}
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.hint}>
              Speak naturally — read something out loud or talk about your day.
            </Text>
          </>
        )}

        {phase === "uploading" && (
          <>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.uploadingLabel, { color: colors.text }]}>
              Your voice is being uploaded and cloned…
            </Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>This might take a while.</Text>
          </>
        )}

        {phase === "done" && (
          <>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={styles.doneLabel}>Voice successfully cloned!</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 80,
  },

  // Idle
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    marginBottom: 20,
  },
  micIcon: {
    fontSize: 52,
  },
  hint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 20,
  },

  // Recording
  recordingRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  countdownText: {
    fontSize: 40,
    fontWeight: "700",
    color: "#EF4444",
  },
  recordingLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#EF4444",
    marginBottom: 20,
  },
  progressBarBg: {
    width: "80%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4F46E5",
    borderRadius: 3,
  },

  // Uploading
  uploadingLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    marginTop: 20,
  },

  // Done
  doneIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  doneLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: "#22C55E",
  },
});
