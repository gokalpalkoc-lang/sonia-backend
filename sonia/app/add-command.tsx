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
    TouchableOpacity
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCommands } from "@/context/commands-context";

export default function AddCommandScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addCommand } = useCommands();

  const [timeInput, setTimeInput] = useState("");
  const [promptInput, setPromptInput] = useState("");

  const handleAppend = () => {
    if (!timeInput.trim() || !promptInput.trim()) {
      Alert.alert("Missing Fields", "Please enter both time and prompt.");
      return;
    }

    addCommand({ time: timeInput.trim(), prompt: promptInput.trim(), expanded: false });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>New Command</Text>
        <Text style={styles.subtitle}>
          Set a time and a prompt for the command.
        </Text>

        {/* Time */}
        <Text style={styles.label}>Time</Text>
        <TextInput
          style={styles.input}
          placeholder="HH:MM"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={timeInput}
          onChangeText={setTimeInput}
          keyboardType="numbers-and-punctuation"
          autoFocus
        />

        {/* Prompt */}
        <Text style={styles.label}>Prompt</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the command..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={promptInput}
          onChangeText={setPromptInput}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleAppend}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>Save Command</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
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
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
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
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  submitButton: {
    width: "100%",
    backgroundColor: "#4F46E5",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
});
