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

const PASSWORD = "1234";

export default function PasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [passwordInput, setPasswordInput] = useState("");

  const checkPassword = () => {
    if (passwordInput === PASSWORD) {
      setPasswordInput("");
      router.replace("/protected");
    } else {
      Alert.alert("Access Denied", "The password you entered is incorrect.");
      setPasswordInput("");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 40 }]}>
        {/* Lock icon */}
        <View style={styles.lockCircle}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>

        <Text style={styles.title}>Enter Password</Text>
        <Text style={styles.subtitle}>
          This area is password-protected.
        </Text>

        <TextInput
          style={styles.input}
          secureTextEntry
          value={passwordInput}
          onChangeText={setPasswordInput}
          placeholder="Password"
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoFocus
          onSubmitEditing={checkPassword}
          returnKeyType="go"
        />

        <TouchableOpacity
          style={styles.submitButton}
          onPress={checkPassword}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>Unlock</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Go Back</Text>
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  lockIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 32,
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
    marginBottom: 16,
  },
  submitButton: {
    width: "100%",
    backgroundColor: "#4F46E5",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
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
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
});
