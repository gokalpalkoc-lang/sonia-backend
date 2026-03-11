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

import { useCommands } from "@/context/commands-context";
import { apiFetch } from "@/lib/api";
import { scheduleCommandReminder } from "@/lib/notifications";
import { getVoiceId } from "@/lib/storage";
import type { Command } from "@/types/command";

export default function AddCommandScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addCommand } = useCommands();

  const [assistantName, setAssistantName] = useState("");
  const [timeInput, setSaatInput] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [firstMessageInput, setFirstMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAppend = async () => {
    if (!assistantName.trim()) {
      Alert.alert("Eksik Alanlar", "Lütfen bir asistan adı girin.");
      return;
    }
    if (!timeInput.trim() || !promptInput.trim() || !firstMessageInput.trim()) {
      Alert.alert(
        "Eksik Alanlar",
        "Lütfen saat, istem ve ilk mesajı girin.",
      );
      return;
    }

    const newCommand = {
      assistantName: assistantName.trim(),
      time: timeInput.trim(),
      prompt: promptInput.trim(),
      firstMessage: firstMessageInput.trim(),
      expanded: false,
    };

    // Send command to backend server first to get the assistantId
    setIsLoading(true);
    try {
      // Include cloned voice ID if available
      const voiceId = await getVoiceId();
      const payload = voiceId ? { ...newCommand, voiceId } : newCommand;

      const response = await apiFetch('/api/commands', {
        method: "POST",
        body: JSON.stringify(payload),
      });

      let assistantId: string | undefined;
      if (response.ok) {
        const data = await response.json();
        assistantId = data.assistantId ?? undefined;
        console.log("Command sent to backend successfully");
        if (assistantId) {
          console.log("Created assistant ID:", assistantId);
        }
      } else {
        console.error("Failed to send command to backend:", response.status);
      }

      // Add command locally with the assistantId and schedule reminder
      const localCommand: Command = {
        id: `${Date.now()}`,
        assistantName: assistantName.trim(),
        time: timeInput.trim(),
        prompt: promptInput.trim(),
        firstMessage: firstMessageInput.trim(),
        assistantId,
        expanded: false,
      };
      addCommand(localCommand);
      try {
        await scheduleCommandReminder(localCommand);
      } catch (error) {
        console.error("Failed to schedule reminder", error);
      }
    } catch (error) {
      console.error("Error sending command to backend:", error);
      // Still add command locally without assistantId
      const localCommand: Command = {
        id: `${Date.now()}`,
        assistantName: assistantName.trim(),
        time: timeInput.trim(),
        prompt: promptInput.trim(),
        firstMessage: firstMessageInput.trim(),
        expanded: false,
      };
      addCommand(localCommand);
    } finally {
      setIsLoading(false);
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>New Command</Text>
        <Text style={styles.subtitle}>
          Determine assistant name, time, system prompt and a first message for the command.
        </Text>

        {/* Asistan Adı */}
        <Text style={styles.label}>Assistant Name</Text>
        <TextInput
          style={styles.input}
          placeholder="eg. My Assistant..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={assistantName}
          onChangeText={setAssistantName}
          autoFocus
        />

        {/* Saat */}
        <Text style={styles.label}>Time</Text>
        <TextInput
          style={styles.input}
          placeholder="HH:MM"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={timeInput}
          onChangeText={setSaatInput}
          keyboardType="numbers-and-punctuation"
        />

        {/* Prompt (Sistem İstemi) */}
        <Text style={styles.label}>System Prompt</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Explain the command..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={promptInput}
          onChangeText={setPromptInput}
          multiline
          textAlignVertical="top"
        />

        {/* İlk Mesaj */}
        <Text style={styles.label}>First Message</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What should assistant say first?"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={firstMessageInput}
          onChangeText={setFirstMessageInput}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[
            styles.submitButton,
            isLoading && styles.submitButtonDisabled,
          ]}
          onPress={handleAppend}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.submitText}>
            {isLoading ? "Creating..." : "Create Assistant"}
          </Text>
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
  submitButtonDisabled: {
    backgroundColor: "rgba(79,70,229,0.5)",
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
