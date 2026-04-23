import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const { colors } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [patientName, setPatientName] = useState("");
  const [menuPin, setMenuPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !password.trim()) {
      if (Platform.OS === "web") {
        window.alert("Missing data: Please enter username and password.");
      } else {
        Alert.alert("Missing data", "Please enter username and password.");
      }
      return;
    }
    if (!patientName.trim()) {
      if (Platform.OS === "web") {
        window.alert("Missing data: Please enter patient name.");
      } else {
        Alert.alert("Missing data", "Please enter patient name.");
      }
      return;
    }
    if (password.length < 8) {
      if (Platform.OS === "web") {
        window.alert("Weak password: The password must be at least 8 characters long.");
      } else {
        Alert.alert("Weak password", "The password must be at least 8 characters long.");
      }
      return;
    }
    if (menuPin && (menuPin.length !== 4 || !/^\d{4}$/.test(menuPin))) {
      if (Platform.OS === "web") {
        window.alert("Invalid PIN: Menu PIN must be exactly 4 digits.");
      } else {
        Alert.alert("Invalid PIN", "Menu PIN must be exactly 4 digits.");
      }
      return;
    }

    setIsLoading(true);
    try {
      await register(username.trim(), password, patientName.trim(), menuPin.trim());
      router.replace("/");
    } catch (error: any) {
      const msg = error.message || "Please try again.";
      if (Platform.OS === "web") {
        window.alert("Sign up failed: " + msg);
      } else {
        Alert.alert("Sign up failed", msg);
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
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Create a new account.
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="eg. bakici_ali"
          placeholderTextColor={colors.textMuted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="At least 8 characters"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Patient name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="eg. Ahmet Yılmaz"
          placeholderTextColor={colors.textMuted}
          value={patientName}
          onChangeText={setPatientName}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Menu PIN (4 digits)</Text>
        <Text style={[styles.pinHint, { color: colors.textMuted }]}>
          This PIN protects access to the commands menu.
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="eg. 1234"
          placeholderTextColor={colors.textMuted}
          value={menuPin}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, "").slice(0, 4);
            setMenuPin(digits);
          }}
          keyboardType="number-pad"
          maxLength={4}
          onSubmitEditing={handleRegister}
          returnKeyType="go"
        />

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.accent }, isLoading && styles.submitButtonDisabled]}
          onPress={handleRegister}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.submitText}>
            {isLoading ? "Creating account..." : "Sign up"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.loginText, { color: colors.textSecondary }]}>
            Do you already have an account?{" "}
            <Text style={styles.loginLink}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
  },
  inner: {
    paddingHorizontal: 28,
    paddingBottom: 40,
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
    marginBottom: 32,
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pinHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginBottom: 8,
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
    marginBottom: 20,
  },
  submitButton: {
    width: "100%",
    backgroundColor: "#4F46E5",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
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
  loginButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  loginText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  loginLink: {
    color: "#818CF8",
    fontWeight: "600",
  },
});
