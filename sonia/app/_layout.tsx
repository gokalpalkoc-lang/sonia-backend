import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { CommandsProvider } from "@/context/commands-context";
import {
  addNotificationTapListener,
  hasNativeNotifications,
  initializeNotifications,
} from "@/lib/notifications";

function NavigationEffects() {
  const router = useRouter();

  useEffect(() => {
    initializeNotifications().catch((error) => {
      console.warn("Notification init failed", error);
    });

    const notificationSubscription = addNotificationTapListener(
      ({ screen, commandText, commandPayload }) => {
        if (screen === "talk-ai") {
          router.push({
            pathname: "/talk-ai",
            params: {
              ...(commandText ? { commandText } : {}),
              ...(commandPayload ? { commandPayload } : {}),
              autoStart: "1",
            },
          });
        }
      },
    );

    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      const parsed = Linking.parse(url);
      if (parsed.path === "talk-ai") {
        const params = parsed.queryParams ?? {};
        const commandPayload =
          typeof params.commandPayload === "string"
            ? params.commandPayload
            : undefined;
        const commandText =
          typeof params.commandText === "string"
            ? params.commandText
            : undefined;

        router.push({
          pathname: "/talk-ai",
          params: {
            ...(commandText ? { commandText } : {}),
            ...(commandPayload ? { commandPayload } : {}),
            autoStart: "1",
          },
        });
      }
    });

    return () => {
      notificationSubscription.remove();
      linkingSubscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!hasNativeNotifications()) {
      console.info(
        "expo-notifications is not installed. Falling back to in-app reminders only.",
      );
    }
  }, []);

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
