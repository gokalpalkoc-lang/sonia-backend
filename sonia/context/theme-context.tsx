import React, { createContext, useContext, useEffect, useState } from "react";

import { getItem, setItem } from "@/lib/storage";

const THEME_KEY = "app_theme_mode";

export type ThemeMode = "dark" | "light";

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  accentLight: string;
  cardShadow: string;
  overlay: string;
  danger: string;
  dangerBg: string;
}

const darkColors: ThemeColors = {
  background: "#0D0D1A",
  surface: "rgba(255,255,255,0.08)",
  surfaceHover: "rgba(255,255,255,0.12)",
  text: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.7)",
  textMuted: "rgba(255,255,255,0.4)",
  border: "rgba(255,255,255,0.1)",
  accent: "#4F46E5",
  accentLight: "rgba(79, 70, 229, 0.15)",
  cardShadow: "rgba(79, 70, 229, 0.35)",
  overlay: "rgba(0,0,0,0.6)",
  danger: "#EF4444",
  dangerBg: "rgba(239, 68, 68, 0.12)",
};

const lightColors: ThemeColors = {
  background: "#F5F5FA",
  surface: "rgba(0,0,0,0.05)",
  surfaceHover: "rgba(0,0,0,0.08)",
  text: "#1A1A2E",
  textSecondary: "rgba(26,26,46,0.65)",
  textMuted: "rgba(26,26,46,0.4)",
  border: "rgba(0,0,0,0.1)",
  accent: "#4F46E5",
  accentLight: "rgba(79, 70, 229, 0.1)",
  cardShadow: "rgba(79, 70, 229, 0.2)",
  overlay: "rgba(0,0,0,0.4)",
  danger: "#DC2626",
  dangerBg: "rgba(220, 38, 38, 0.08)",
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    getItem(THEME_KEY).then((stored) => {
      if (stored === "light" || stored === "dark") {
        setMode(stored);
      }
    });
  }, []);

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
    setItem(THEME_KEY, newMode).catch(() => {});
  };

  const toggleTheme = () => {
    setTheme(mode === "dark" ? "light" : "dark");
  };

  const colors = mode === "dark" ? darkColors : lightColors;
  const isDark = mode === "dark";

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
