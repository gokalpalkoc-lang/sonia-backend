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

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

interface UserProfile {
  username: string;
  patient_name: string;
  voice_id: string | null;
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
        setToken(storedToken);
        await fetchProfile(storedToken);
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
      .then(() => TaskManager.getRegisteredTasksAsync())
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
    setToken(data.access);
    await fetchProfile(data.access);
  };

  const register = async (
    username: string,
    password: string,
    patientName = "",
  ) => {
    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        patient_name: patientName,
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
