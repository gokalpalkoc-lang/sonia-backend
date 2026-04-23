import React, { createContext, useContext, useEffect, useState } from "react";

import {
  clearAuthTokens,
  clearPushRegistrationFingerprint,
  getAccessToken,
  setAuthTokens,
} from "@/lib/storage";
import {
  registerForPushNotifications,
  startCommandSyncService,
  stopCommandSyncService,
} from "@/lib/notifications";

import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

interface UserProfile {
  username: string;
  patient_name: string;
  voice_id: string | null;
  assistant_id: string | null;
}

interface AuthContextType {
  token: string | null;
  profile: UserProfile | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    patientName?: string,
    menuPin?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (accessToken: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile ?? null);
      }
    } catch (error) {
      console.warn("Failed to fetch user profile:", error);
    }
  };

  useEffect(() => {
    getAccessToken().then(async (storedToken) => {
      if (storedToken) {
        await fetchProfile(storedToken);
        setToken(storedToken);
      }
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      stopCommandSyncService().then(() => console.log("Command sync service stopped")).catch((err) =>
        console.warn("Failed to stop command sync:", err),
      );
      return;
    }

    registerForPushNotifications(token).catch((error) => {
      console.warn("Push token registration failed", error);
    });
    startCommandSyncService()
      .then(() => {
        if (Platform.OS !== "web") {
          return TaskManager.getRegisteredTasksAsync();
        }
        return [];
      })
      .then((tasks) => {
        console.log("Registered background tasks:", tasks);
      })
      .catch((err) =>
        console.warn("Failed to start command sync:", err),
      );

    return () => {
      stopCommandSyncService().catch((err) =>
        console.warn("Failed to stop command sync:", err),
      );
    };
  }, [token, isLoading]);

  const login = async (username: string, password: string) => {
    username = username.trim().toLowerCase();
    const response = await fetch(`${BACKEND_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || "Giriş başarısız");
    }

    const data = await response.json();
    await setAuthTokens(data.access, data.refresh);
    await fetchProfile(data.access);
    setToken(data.access);
  };

  const register = async (
    username: string,
    password: string,
    patientName = "",
    menuPin = "",
  ) => {
    username = username.trim().toLowerCase();
    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        patient_name: patientName,
        menu_pin: menuPin,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      const firstError =
        data.errors
          ? Object.values(data.errors as Record<string, string[]>)[0]?.[0]
          : data.error;
      throw new Error(firstError || "Kayıt başarısız");
    }

    // Auto-login after successful registration
    await login(username, password);
  };

  const logout = async () => {
    await clearAuthTokens();
    await clearPushRegistrationFingerprint();
    setToken(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchProfile(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{ token, profile, isLoading, login, register, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
