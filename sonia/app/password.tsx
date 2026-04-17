import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";
import { apiFetch } from "@/lib/api";

export default function PasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { colors } = useTheme();

  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    if (!pin.trim() || pin.length !== 4) {
      Alert.alert("Invalid PIN", "Please enter a 4-digit PIN.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch("/api/auth/verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        router.replace("/protected");
      } else {
        Alert.alert("Incorrect PIN", data.error || "Please try again.");
        setPin("");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not verify PIN.");
    } finally {
      setIsLoading(false);
    }
  };

  // If not authenticated, redirect to login
  if (!token) {
    router.replace("/");
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 80 }]}>
        <View style={[styles.lockCircle, { backgroundColor: colors.accentLight }]}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Menu Access</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your 4-digit PIN to access the menu.
        </Text>

        <TextInput
          style={[styles.pinInput, { backgroundColor: colors.surface, borderColor: colors.accent, color: colors.text }]}
          placeholder="• • • •"
          placeholderTextColor={colors.textMuted}
          value={pin}
          onChangeText={(text) => {
            // Only allow digits, max 4
            const digits = text.replace(/\D/g, "").slice(0, 4);
            setPin(digits);
          }}
          keyboardType="number-pad"
          maxLength={4}
          secureTextEntry
          textAlign="center"
          autoFocus
          onSubmitEditing={handleVerify}
          returnKeyType="go"
        />

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.accent }, isLoading && styles.submitButtonDisabled]}
          onPress={handleVerify}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.submitText}>
            {isLoading ? "Verifying..." : "Unlock Menu"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/carousel");
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.backText, { color: colors.textMuted }]}>← Back to Carousel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  lockCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  lockIcon: {
    fontSize: 44,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 40,
    textAlign: "center",
  },
  pinInput: {
    width: 200,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2,
    borderColor: "rgba(79, 70, 229, 0.4)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 16,
    marginBottom: 24,
  },
  submitButton: {
    width: "100%",
    backgroundColor: "#4F46E5",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: "rgba(79,70,229,0.5)",
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    paddingVertical: 12,
  },
  backText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
});
