import { Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, token, isLoading: authLoading, profile } = useAuth();
  const { colors } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, redirect to carousel
  if (authLoading) {
    return (
      <View
        style={[
          styles.container,
          { alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (token) {
    // If voice setup not done, go to voice-setup; otherwise carousel
    const hasVoice = !!(profile?.voice_id);
    if (!hasVoice) {
      return <Redirect href={"/voice-setup" as const} />;
    }
    return <Redirect href={"/carousel" as const} />;
  }

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      if (Platform.OS === "web") {
        window.alert("Missing Data: Please enter username and password.");
      } else {
        Alert.alert("Missing Data", "Please enter username and password.");
      }
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password);
      // After login, the token state updates and causes a redirect above
    } catch (error: any) {
      const msg = error.message || "Please try again.";
      if (Platform.OS === "web") {
        window.alert("Access denied: " + msg);
      } else {
        Alert.alert("Access denied", msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 60 }]}>
        <View style={[styles.logoCircle, { backgroundColor: colors.accentLight }]}>
          <Text style={[styles.logoIcon, { color: colors.accent }]}>✦</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Giriş Yap</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Log into your account.</Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Username"
          placeholderTextColor={colors.textMuted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          returnKeyType="go"
        />

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.accent }, isLoading && styles.submitButtonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.submitText}>
            {isLoading ? "Logging in..." : "Log in."}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push("/register")}
          activeOpacity={0.7}
        >
          <Text style={[styles.registerText, { color: colors.textSecondary }]}>
            Do you not have an account?{" "}
            <Text style={styles.registerLink}>Sign up</Text>
          </Text>
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
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logoIcon: {
    fontSize: 36,
    color: "#4F46E5",
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
    marginBottom: 36,
    textAlign: "center",
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#fff",
    marginBottom: 14,
  },
  submitButton: {
    width: "100%",
    backgroundColor: "#4F46E5",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
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
  registerButton: {
    paddingVertical: 12,
  },
  registerText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  registerLink: {
    color: "#818CF8",
    fontWeight: "600",
  },
});
