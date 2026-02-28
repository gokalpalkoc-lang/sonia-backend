import AsyncStorage from "@react-native-async-storage/async-storage";

const VOICE_ID_KEY = "elevenlabs_voice_id";
const VOICE_SETUP_DONE_KEY = "voice_setup_done";
const ACCESS_TOKEN_KEY = "auth_access_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";
const NATIVE_MODULE_NULL_MESSAGE = "Native module is null";

const memoryStorage = new Map<string, string>();

function isMissingNativeStorage(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(NATIVE_MODULE_NULL_MESSAGE)
  );
}

async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    if (isMissingNativeStorage(error)) {
      return memoryStorage.get(key) ?? null;
    }

    throw error;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    if (isMissingNativeStorage(error)) {
      memoryStorage.set(key, value);
      return;
    }

    throw error;
  }
}

async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    if (isMissingNativeStorage(error)) {
      memoryStorage.delete(key);
      return;
    }
    throw error;
  }
}

/** Get the stored ElevenLabs cloned voice ID */
export async function getVoiceId(): Promise<string | null> {
  return getItem(VOICE_ID_KEY);
}

/** Store the ElevenLabs cloned voice ID and mark setup as complete */
export async function setVoiceId(voiceId: string): Promise<void> {
  await setItem(VOICE_ID_KEY, voiceId);
  await setItem(VOICE_SETUP_DONE_KEY, "true");
}

/** Check if voice setup (recording + cloning) has been completed */
export async function isVoiceSetupDone(): Promise<boolean> {
  const value = await getItem(VOICE_SETUP_DONE_KEY);
  return value === "true";
}

/** Get the stored JWT access token */
export async function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_TOKEN_KEY);
}

/** Store JWT access and refresh tokens */
export async function setAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  await setItem(ACCESS_TOKEN_KEY, accessToken);
  await setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/** Clear stored JWT tokens (on logout) */
export async function clearAuthTokens(): Promise<void> {
  await removeItem(ACCESS_TOKEN_KEY);
  await removeItem(REFRESH_TOKEN_KEY);
}

/** Attempt to refresh the access token using the stored refresh token */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      await setItem(ACCESS_TOKEN_KEY, data.access);
      return data.access;
    }
  } catch (error) {
    console.warn("Failed to refresh access token:", error);
  }

  return null;
}

