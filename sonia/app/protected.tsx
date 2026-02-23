import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCommands } from "@/context/commands-context";

export default function ProtectedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { commands, deleteCommand, toggleExpand } = useCommands();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Commands</Text>
        <Text style={styles.badge}>{commands.length}</Text>
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
            <Text style={styles.emptyTitle}>No commands yet</Text>
            <Text style={styles.emptyText}>
              Tap "Add Command" to create your first one.
            </Text>
          </View>
        )}

        {commands.map((cmd, index) => (
          <View key={index} style={styles.commandCard}>
            <View style={styles.commandHeader}>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{cmd.time}</Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteCommand(index)}
                style={styles.deleteButton}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text
              style={styles.promptText}
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
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/add-command")}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+ Add Command</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => router.dismissAll()}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Log Out</Text>
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
  logoutButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
});
