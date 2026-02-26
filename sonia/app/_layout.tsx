import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { CommandsProvider } from "@/context/commands-context";
import {
  addNotificationReceivedListener,
  addNotificationTapListener,
  initializeNotifications,
  registerForPushNotifications,
  type NotificationPayload,
} from "@/lib/notifications";

function NavigationEffects() {
  const router = useRouter();

  useEffect(() => {
    const openTalkAi = ({
      screen,
      assistantId,
    }: NotificationPayload) => {
      if (screen !== "talk-ai") return;

      router.push({
        pathname: "/talk-ai",
        params: {
          ...(assistantId ? { assistantId } : {}),
          autoStart: "1",
        },
      });
    };

    initializeNotifications().catch((error) => {
      console.warn("Notification init failed", error);
    });

    // Register device for remote push notifications
    registerForPushNotifications().catch((error) => {
      console.warn("Push token registration failed", error);
    });

    // Handle cold-start: if the app was killed and user tapped a notification,
    // the tap listener won't fire. Check for the last notification response.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data ?? {};
        openTalkAi({
          screen: typeof data.screen === "string" ? data.screen : undefined,
          assistantId:
            typeof data.assistantId === "string" ? data.assistantId : undefined,
        });
      }
    });

    const notificationTapSubscription = addNotificationTapListener(openTalkAi);
    const notificationReceivedSubscription = addNotificationReceivedListener(openTalkAi);

    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      const parsed = Linking.parse(url);
      if (parsed.path === "talk-ai") {
        const params = parsed.queryParams ?? {};
        const assistantId =
          typeof params.assistantId === "string"
            ? params.assistantId
            : undefined;
            
        router.push({
          pathname: "/talk-ai",
          params: {
            ...(assistantId ? { assistantId } : {}),
            autoStart: "1",
          },
        });
      }
    });

    return () => {
      notificationTapSubscription.remove();
      notificationReceivedSubscription.remove();
      linkingSubscription.remove();
    };
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <CommandsProvider>
      <NavigationEffects />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0D0D1A" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="voice-setup" options={{ gestureEnabled: false }} />
        <Stack.Screen name="index" />
        <Stack.Screen name="password" />
        <Stack.Screen name="protected" options={{ gestureEnabled: false }} />
        <Stack.Screen name="talk-ai" />
        <Stack.Screen
          name="add-command"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
      <StatusBar style="light" />
    </CommandsProvider>
  );
}
