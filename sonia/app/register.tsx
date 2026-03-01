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
      Alert.alert("Eksik Bilgi", "Lütfen kullanıcı adı ve şifreyi girin.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Zayıf Şifre", "Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setIsLoading(true);
    try {
      await register(username.trim(), password, patientName.trim());
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Kayıt Başarısız", error.message || "Lütfen tekrar deneyin.");
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
        <Text style={styles.title}>Hesap Oluştur</Text>
        <Text style={styles.subtitle}>
          Yeni bir hesap oluşturun.
        </Text>

        <Text style={styles.label}>Kullanıcı Adı</Text>
        <TextInput
          style={styles.input}
          placeholder="ör. bakici_ali"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        <Text style={styles.label}>Şifre</Text>
        <TextInput
          style={styles.input}
          placeholder="En az 8 karakter"
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Hasta Adı (İsteğe bağlı)</Text>
        <TextInput
          style={styles.input}
          placeholder="ör. Ahmet Yılmaz"
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
            {isLoading ? "Hesap oluşturuluyor..." : "Kayıt Ol"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.loginText}>
            Zaten hesabınız var mı?{" "}
            <Text style={styles.loginLink}>Giriş Yap</Text>
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
