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

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen kullanıcı adı ve şifreyi girin.");
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password);
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Giriş Başarısız", error.message || "Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 60 }]}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>✦</Text>
        </View>

        <Text style={styles.title}>Giriş Yap</Text>
        <Text style={styles.subtitle}>Hesabınıza giriş yapın.</Text>

        <TextInput
          style={styles.input}
          placeholder="Kullanıcı Adı"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          returnKeyType="go"
        />

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.submitText}>
            {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push("/register")}
          activeOpacity={0.7}
        >
          <Text style={styles.registerText}>
            Hesabınız yok mu?{" "}
            <Text style={styles.registerLink}>Kayıt Ol</Text>
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
