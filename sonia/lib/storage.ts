import AsyncStorage from "@react-native-async-storage/async-storage";

const VOICE_ID_KEY = "elevenlabs_voice_id";
const VOICE_SETUP_DONE_KEY = "voice_setup_done";
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
  console.log(await getItem(VOICE_ID_KEY))
  return value === "true";
}
