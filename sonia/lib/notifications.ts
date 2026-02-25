import { Alert, AppState } from "react-native";

import type { Command } from "@/types/command";

type NotificationModule = {
  AndroidImportance?: { HIGH: number };
  setNotificationHandler?: (handler: {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowBanner?: boolean;
      shouldShowList?: boolean;
    }>;
  }) => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  setNotificationChannelAsync?: (channelId: string, config: Record<string, unknown>) => Promise<void>;
  scheduleNotificationAsync: (request: {
    content: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
      sound?: boolean;
    };
    trigger: { type: "date"; date: Date };
  }) => Promise<string>;
  addNotificationResponseReceivedListener?: (listener: (response: {
    notification: {
      request: { content: { data?: Record<string, unknown> } };
    };
  }) => void) => { remove: () => void };
};

export interface NotificationTapPayload {
  screen?: string;
  commandText?: string;
  commandPayload?: string;
}

let notifications: NotificationModule | null = null;

try {
  // Optional dependency: keeps app functional if expo-notifications cannot be installed.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  notifications = require("expo-notifications");
} catch {
  notifications = null;
}

const inAppTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function hasNativeNotifications() {
  return Boolean(notifications);
}

export function encodeCommandPayload(command: Command) {
  const payload = {
    assistantName: command.assistantName ?? "",
    time: command.time,
    prompt: command.prompt,
    firstMessage: command.firstMessage ?? "",
  };

  return encodeURIComponent(JSON.stringify(payload));
}

export async function initializeNotifications() {
  if (!notifications) return;

  notifications.setNotificationHandler?.({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const { granted } = await notifications.requestPermissionsAsync();
  if (!granted) return;

  await notifications.setNotificationChannelAsync?.("commands", {
    name: "Command Reminders",
    importance: notifications.AndroidImportance?.HIGH ?? 4,
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
  const trigger = getNextTriggerDate(command.time);
  const commandText = command.prompt;
  const commandPayload = encodeCommandPayload(command);

  if (notifications) {
    await notifications.scheduleNotificationAsync({
      content: {
        title: "Sonia Command Reminder",
        body: commandText,
        sound: true,
        data: {
          screen: "talk-ai",
          commandText,
          commandPayload,
        },
      },
      trigger: { type: "date", date: trigger },
    });
    return;
  }

  const ms = trigger.getTime() - Date.now();
  if (ms <= 0) return;

  const timer = setTimeout(() => {
    if (AppState.currentState !== "active") return;
    Alert.alert("Sonia Command Reminder", commandText);
  }, ms);

  inAppTimers.set(`${command.time}-${command.prompt}`, timer);
}

export function addNotificationTapListener(onTap: (payload: NotificationTapPayload) => void) {
  if (!notifications?.addNotificationResponseReceivedListener) {
    return { remove: () => undefined };
  }

  return notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    onTap({
      screen: typeof data.screen === "string" ? data.screen : undefined,
      commandText: typeof data.commandText === "string" ? data.commandText : undefined,
      commandPayload: typeof data.commandPayload === "string" ? data.commandPayload : undefined,
    });
  });
}
