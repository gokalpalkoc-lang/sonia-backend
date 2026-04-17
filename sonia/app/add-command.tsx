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
import { useTheme } from "@/context/theme-context";
import { apiFetch } from "@/lib/api";
import { scheduleCommandReminder } from "@/lib/notifications";
import type { Command } from "@/types/command";

export default function AddCommandScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addCommand } = useCommands();
  const { colors } = useTheme();

  const [timeInput, setSaatInput] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [firstMessageInput, setFirstMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAppend = async () => {
    if (!timeInput.trim() || !promptInput.trim() || !firstMessageInput.trim()) {
      Alert.alert(
        "Missing Fields",
        "Please enter time, prompt, and first message.",
      );
      return;
    }

    const newCommand = {
      time: timeInput.trim(),
      prompt: promptInput.trim(),
      firstMessage: firstMessageInput.trim(),
      expanded: false,
    };

    setIsLoading(true);
    try {
      const response = await apiFetch('/api/commands', {
        method: "POST",
        body: JSON.stringify(newCommand),
      });

      let commandId: number | string | undefined;
      if (response.ok) {
        const data = await response.json();
        commandId = data.commandId ?? undefined;
        console.log("Command sent to backend successfully");
      } else {
        console.error("Failed to send command to backend:", response.status);
      }

      // Add command locally and schedule reminder
      const localCommand: Command = {
        id: commandId ?? `${Date.now()}`,
        time: timeInput.trim(),
        prompt: promptInput.trim(),
        firstMessage: firstMessageInput.trim(),
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
      // Still add command locally
      const localCommand: Command = {
        id: `${Date.now()}`,
        time: timeInput.trim(),
        prompt: promptInput.trim(),
        firstMessage: firstMessageInput.trim(),
        expanded: false,
      };
      addCommand(localCommand);
    } finally {
      setIsLoading(false);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/carousel");
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>New Command</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Set a time, system prompt addition, and a first message for the command.
        </Text>

        {/* Time */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Time</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="HH:MM"
          placeholderTextColor={colors.textMuted}
          value={timeInput}
          onChangeText={setSaatInput}
          keyboardType="numbers-and-punctuation"
          autoFocus
        />

        {/* Prompt (System Prompt Addition) */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>System Prompt Addition</Text>
        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
          This will be appended to the assistant's base prompt during the conversation.
        </Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Extra instructions for the assistant..."
          placeholderTextColor={colors.textMuted}
          value={promptInput}
          onChangeText={setPromptInput}
          multiline
          textAlignVertical="top"
        />

        {/* First Message */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>First Message</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="What should assistant say first?"
          placeholderTextColor={colors.textMuted}
          value={firstMessageInput}
          onChangeText={setFirstMessageInput}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.accent },
            isLoading && styles.submitButtonDisabled,
          ]}
          onPress={handleAppend}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.submitText}>
            {isLoading ? "Creating..." : "Add Command"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/carousel");
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
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
  fieldHint: {
    color: "rgba(255,255,255,0.3)",
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
