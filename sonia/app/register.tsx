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

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [patientName, setPatientName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Missing data", "Please enter username and password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak password", "The password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      await register(username.trim(), password, patientName.trim());
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Sign up failed", error.message || "Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>
          Create a new account.
        </Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="eg. bakici_ali"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="At least 8 characters"
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Patient name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="eg. Ahmet Yılmaz"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={patientName}
          onChangeText={setPatientName}
          onSubmitEditing={handleRegister}
          returnKeyType="go"
        />

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
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
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.loginText}>
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
