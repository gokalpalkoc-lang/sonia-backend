import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";

import { AuthProvider } from "@/context/auth-context";
import { CommandsProvider } from "@/context/commands-context";
import { ThemeProvider, useTheme } from "@/context/theme-context";
import {
  addNotificationReceivedListener,
  addNotificationTapListener,
  initializeNotifications,
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

    // Handle cold-start: if the app was killed and user tapped a notification,
    // the tap listener won't fire. Check for the last notification response.
    if (Platform.OS !== "web") {
      const response = Notifications.getLastNotificationResponse();
      if (response) {
        const data = response.notification.request.content.data ?? {};
        openTalkAi({
          screen: typeof data.screen === "string" ? data.screen : undefined,
          assistantId:
            typeof data.assistantId === "string" ? data.assistantId : undefined,
        });
      }
    }

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

function ThemedApp() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <NavigationEffects />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="register" />
        <Stack.Screen name="voice-setup" options={{ gestureEnabled: false }} />
        <Stack.Screen name="carousel" />
        <Stack.Screen name="password" />
        <Stack.Screen name="protected" options={{ gestureEnabled: false }} />
        <Stack.Screen name="talk-ai" />
        <Stack.Screen
          name="add-command"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CommandsProvider>
          <ThemedApp />
        </CommandsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
