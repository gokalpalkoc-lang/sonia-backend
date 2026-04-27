import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { useCommands } from "@/context/commands-context";
import { useTheme } from "@/context/theme-context";
import { apiFetch } from "@/lib/api";

export default function ProtectedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { commands, deleteCommand, toggleExpand, setCommands } = useCommands();
  const { logout } = useAuth();
  const { colors } = useTheme();

  // Fetch commands from backend on mount (authenticated)
  React.useEffect(() => {
    apiFetch('/api/commands')
      .then((res) => res.json())
      .then((data) => {
        setCommands(data.commands ?? []);
        console.log("Fetched commands from backend:", data.commands);
      })
      .catch((error) => {
        console.error("Error fetching commands:", error);
      });
  }, [setCommands]);

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  const handleActivateCommand = async (commandId: number | string) => {
    try {
      const response = await apiFetch('/api/commands/activate', {
        method: 'POST',
        body: JSON.stringify({ commandId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Navigate to talk-ai with autoStart — the assistant prompt has been patched
        router.push({
          pathname: "/talk-ai",
          params: {
            autoStart: "1",
            assistantId: data.assistantId || "",
          },
        });
      } else {
        Alert.alert("Error", data.error || "Could not activate command.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to activate command.");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Commands</Text>
        <Text style={[styles.badge, { backgroundColor: colors.accent }]}>{commands.length}</Text>
      </View>

      {/* Command list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {commands.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No command yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Click &quot;Add Command&quot; to create your first command.
            </Text>
          </View>
        )}

        {commands.map((cmd, index) => (
          <View key={cmd.id ?? index} style={[styles.commandCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.commandHeader}>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{cmd.time}</Text>
              </View>
              <View style={styles.commandActions}>
                <TouchableOpacity
                  onPress={() => handleActivateCommand(cmd.id!)}
                  style={styles.activateButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.activateText}>▶ Start</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteCommand(index)}
                  style={styles.deleteButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text
              style={[styles.promptText, { color: colors.textSecondary }]}
              numberOfLines={cmd.expanded ? undefined : 2}
            >
              {cmd.prompt}
            </Text>

            {cmd.prompt.length > 80 && (
              <TouchableOpacity
                onPress={() => toggleExpand(index)}
                activeOpacity={0.7}
              >
                <Text style={styles.expandText}>
                  {cmd.expanded ? "Show less ▲" : "Show more ▼"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom actions */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.accent }]}
          onPress={() => router.push("/add-command")}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+ Add command</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/carousel")}
          activeOpacity={0.7}
        >
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back to Carousel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={[styles.logoutText, { color: colors.textMuted }]}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  badge: {
    marginLeft: 10,
    backgroundColor: "#4F46E5",
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: "hidden",
  },
  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
  },
  // Command card
  commandCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  commandHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  commandActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeBadge: {
    backgroundColor: "rgba(79,70,229,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    color: "#A5B4FC",
    fontSize: 13,
    fontWeight: "600",
  },
  activateButton: {
    backgroundColor: "rgba(34,197,94,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  activateText: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "600",
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
  },
  promptText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 20,
  },
  expandText: {
    color: "#818CF8",
    fontSize: 13,
    marginTop: 8,
    fontWeight: "500",
  },
  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  addButton: {
    backgroundColor: "#4F46E5",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  backText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  logoutButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
});
