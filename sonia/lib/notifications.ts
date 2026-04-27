import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { apiFetch } from "@/lib/api";
import {
  getPushRegistrationFingerprint,
  setPushRegistrationFingerprint,
} from "@/lib/storage";
import type { Command } from "@/types/command";
import { getItem, setItem } from "@/lib/storage";

export interface NotificationPayload {
  screen?: string;
  commandText?: string;
  assistantId?: string;
  commandId?: string | number;
}

function toNotificationPayload(data: Record<string, unknown>) {
  return {
    screen: typeof data.screen === "string" ? data.screen : undefined,
    commandText:
      typeof data.commandText === "string" ? data.commandText : undefined,
    assistantId:
      typeof data.assistantId === "string" ? data.assistantId : undefined,
    commandId: data.commandId as string | number | undefined,
  } satisfies NotificationPayload;
}

/**
 * Must be called at module level (outside any component) so the native
 * notification system knows how to present a notification that arrives
 * while the app is in the foreground.  If this is deferred to a
 * useEffect / async call the handler may not be registered in time and
 * foreground notifications are silently dropped.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data ?? {};
    const willAutoNavigate = data.screen === "talk-ai";

    return {
      shouldShowAlert: !willAutoNavigate,
      shouldPlaySound: !willAutoNavigate,
      shouldSetBadge: false,
      shouldShowBanner: !willAutoNavigate,
      shouldShowList: !willAutoNavigate,
    };
  },
});

/**
 * Register the device's Expo push token with the backend so it can
 * receive server-initiated push notifications.
 */
export async function registerForPushNotifications(dedupeKey = "default") {
  if (Platform.OS === "web") return null;

  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  const fingerprint = `${dedupeKey}:${tokenData.data}`;
  const lastRegisteredFingerprint = await getPushRegistrationFingerprint();
  if (lastRegisteredFingerprint === fingerprint) {
    return tokenData.data;
  }

  try {
    const response = await apiFetch('/api/register-push-token', {
      method: "POST",
      body: JSON.stringify({ token: tokenData.data }),
    });

    if (!response.ok) {
      throw new Error(`Push token registration failed with ${response.status}`);
    }

    await setPushRegistrationFingerprint(fingerprint);
  } catch (error) {
    console.warn("Failed to register push token with backend", error);
  }

  return tokenData.data;
}



export async function initializeNotifications() {
  if (Platform.OS === "web") return;

  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return;

  await Notifications.setNotificationChannelAsync("commands", {
    name: "Komut Hatırlatıcıları",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

function getNextTriggerDate(time: string) {
  const [rawHour, rawMinute] = time.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error("Time must be HH:MM");
  }

  const now = new Date();
  const trigger = new Date(now);
  trigger.setHours(hour, minute, 0, 0);

  if (trigger <= now) {
    trigger.setDate(trigger.getDate() + 1);
  }

  return trigger;
}

export async function scheduleCommandReminder(command: Command) {
  if (Platform.OS === "web") return;

  const trigger = getNextTriggerDate(command.time);
  const commandText = command.prompt;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Sonia Komut Hatırlatıcısı",
      body: commandText,
      sound: true,
      data: {
        screen: "talk-ai",
        commandText,
        assistantId: command.assistantId ?? "",
        commandId: command.id,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
      channelId: "commands",
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Background sync – uses expo-background-task to poll for new       */
/*  commands even when the app is not in the foreground.               */
/* ------------------------------------------------------------------ */

const COMMAND_SYNC_TASK = "com.bilisimcevre.sony.command-sync";

async function syncCommandNotifications(): Promise<void> {
  console.log("Running background command sync...");
  getItem("last_command_sync_time").then((time) => console.log("Last sync time:", time));
  getItem("last_command_sync_data").then((data) => console.log("Last sync data:", data));
  const response = await apiFetch("/api/commands");
  if (!response.ok) return;

  // Store the current time as the last successful sync time
  await setItem("last_command_sync_time", new Date().toISOString());
  
  const { commands: backendCommands } = (await response.json()) as {
    commands: Command[];
  };
  
  await setItem("last_command_sync_data", backendCommands.map(cmd => `${cmd.time} - ${cmd.prompt}`).join("\n"));

  // Collect assistantIds that already have a pending local notification
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = new Set(
    scheduled
      .map((n) => n.content.data?.assistantId)
      .filter((id): id is string => typeof id === "string"),
  );

  // Schedule only for commands that are not yet in the notification queue
  for (const cmd of backendCommands) {
    if (cmd.assistantId && !scheduledIds.has(cmd.assistantId)) {
      await scheduleCommandReminder({
        time: cmd.time,
        prompt: cmd.prompt,
        assistantId: cmd.assistantId,
        expanded: false,
      });
    }
  }
}

// Must be defined at module (global) scope so the native task runner
// can find it even when the app is launched headlessly in the background.
if (Platform.OS !== "web") {
  TaskManager.defineTask(COMMAND_SYNC_TASK, async () => {
    try {
      await syncCommandNotifications();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.warn("Background command sync failed:", error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function startCommandSyncService() {
  if (Platform.OS === "web") return;

  // Run once immediately so the user doesn't wait for the first background cycle
  syncCommandNotifications().catch((err) =>
    console.warn("Initial command sync failed:", err),
  );

  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(COMMAND_SYNC_TASK);
  if (isRegistered) return;

  await BackgroundTask.registerTaskAsync(COMMAND_SYNC_TASK, {
    minimumInterval: 15,
  });
}

export async function stopCommandSyncService() {
  if (Platform.OS === "web") return;

  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(COMMAND_SYNC_TASK);
  if (!isRegistered) return;

  await BackgroundTask.unregisterTaskAsync(COMMAND_SYNC_TASK);
}

export function addNotificationReceivedListener(
  onReceive: (payload: NotificationPayload) => void,
) {
  if (Platform.OS === "web") return { remove: () => {} } as any;
  return Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data ?? {};
    onReceive(toNotificationPayload(data));
  });
}

export function addNotificationTapListener(
  onTap: (payload: NotificationPayload) => void,
) {
  if (Platform.OS === "web") return { remove: () => {} } as any;
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    onTap(toNotificationPayload(data));
  });
}
