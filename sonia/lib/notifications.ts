import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import type { Command } from "@/types/command";

export interface NotificationPayload {
  screen?: string;
  commandText?: string;
  assistantId?: string;
}

function toNotificationPayload(data: Record<string, unknown>) {
  return {
    screen: typeof data.screen === "string" ? data.screen : undefined,
    commandText:
      typeof data.commandText === "string" ? data.commandText : undefined,
    assistantId:
      typeof data.assistantId === "string" ? data.assistantId : undefined,
  } satisfies NotificationPayload;
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

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
export async function registerForPushNotifications() {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  try {
    await fetch(`${BACKEND_URL}/api/register-push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenData.data }),
    });
  } catch (error) {
    console.warn("Failed to register push token with backend", error);
  }

  return tokenData.data;
}



export async function initializeNotifications() {
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
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
      channelId: "commands",
    },
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

export function addNotificationTapListener(
  onTap: (payload: NotificationPayload) => void,
) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    onTap(toNotificationPayload(data));
  });
}
