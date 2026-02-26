import * as Notifications from "expo-notifications";

import type { Command } from "@/types/command";

export interface NotificationPayload {
  screen?: string;
  commandText?: string;
  commandPayload?: string;
}

function toNotificationPayload(data: Record<string, unknown>) {
  return {
    screen: typeof data.screen === "string" ? data.screen : undefined,
    commandText: typeof data.commandText === "string" ? data.commandText : undefined,
    commandPayload:
      typeof data.commandPayload === "string" ? data.commandPayload : undefined,
  } satisfies NotificationPayload;
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
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return;

  await Notifications.setNotificationChannelAsync("commands", {
    name: "Command Reminders",
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
  const trigger = getNextTriggerDate(command.time);
  const commandText = command.prompt;
  const commandPayload = encodeCommandPayload(command);

  await Notifications.scheduleNotificationAsync({
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
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
}

export function addNotificationReceivedListener(
  onReceive: (payload: NotificationPayload) => void,
) {
  return Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data ?? {};
    onReceive(toNotificationPayload(data));
  });
}

export function addNotificationTapListener(onTap: (payload: NotificationPayload) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    onTap(toNotificationPayload(data));
  });
}
