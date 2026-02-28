import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";

/**
 * This screen now simply redirects to the login screen.
 * Authentication is handled via JWT (see login.tsx).
 */
export default function PasswordScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4F46E5" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
    alignItems: "center",
    justifyContent: "center",
  },
});

