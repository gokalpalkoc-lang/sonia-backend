import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { CommandsProvider } from "@/context/commands-context";

export default function RootLayout() {
  return (
    <CommandsProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0D0D1A" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="password" />
        <Stack.Screen
          name="protected"
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="add-command"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
      <StatusBar style="light" />
    </CommandsProvider>
  );
}
