import AsyncStorage from "@react-native-async-storage/async-storage";

const VOICE_ID_KEY = "elevenlabs_voice_id";
const VOICE_SETUP_DONE_KEY = "voice_setup_done";

/** Get the stored ElevenLabs cloned voice ID */
export async function getVoiceId(): Promise<string | null> {
  return AsyncStorage.getItem(VOICE_ID_KEY);
}

/** Store the ElevenLabs cloned voice ID and mark setup as complete */
export async function setVoiceId(voiceId: string): Promise<void> {
  await AsyncStorage.setItem(VOICE_ID_KEY, voiceId);
  await AsyncStorage.setItem(VOICE_SETUP_DONE_KEY, "true");
}

/** Check if voice setup (recording + cloning) has been completed */
export async function isVoiceSetupDone(): Promise<boolean> {
  const value = await AsyncStorage.getItem(VOICE_SETUP_DONE_KEY);
  return value === "true";
}
