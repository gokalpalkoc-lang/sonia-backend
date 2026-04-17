import Vapi from "@vapi-ai/web";
import { VAPI_PUBLIC_KEY } from "./config";

// Initialize Vapi immediately at module load time — before React renders.
export const vapi = new Vapi(VAPI_PUBLIC_KEY);

// Check URL params eagerly and start the call right away if start_assistant_id is present.
const params = new URLSearchParams(window.location.search);
const startAssistantId = params.get("start_assistant_id")?.trim();

export const earlyStartAssistantId: string | null = startAssistantId || null;

// Track whether the early call was already fired so the React component doesn't duplicate it.
export let earlyCallFired = false;

if (earlyStartAssistantId) {
  earlyCallFired = true;

  // Warm up the microphone in parallel with vapi.start().
  // Once the user grants permission here, the Vapi SDK won't have to wait
  // for the browser prompt — getUserMedia resolves instantly.
  navigator.mediaDevices
    ?.getUserMedia({ audio: true })
    .then((stream) => {
      // Release the mic immediately so Vapi can claim it.
      stream.getTracks().forEach((t) => t.stop());
      console.log("🎤 Microphone pre-warmed");
    })
    .catch(() => {
      // Non-fatal — Vapi will request it again itself.
    });

  // Fire-and-forget — the React component will attach event listeners that
  // still work because Vapi queues events internally.
  vapi.start(earlyStartAssistantId).catch((err) => {
    console.error("Early vapi.start() failed:", err);
    earlyCallFired = false; // allow React to retry
  });
  console.log(
    `🚀 Early call fired for assistant ${earlyStartAssistantId} (before React mount)`,
  );
}
