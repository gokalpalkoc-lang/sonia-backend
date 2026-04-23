import { useEffect, useRef, useState } from "react";
import "./App.css";
import { API_BASE_URL, ASSISTANT_ID } from "./config";
import { vapi, earlyStartAssistantId, earlyCallFired } from "./vapi-instance";

function App() {
  const queryAssistantId =
    new URLSearchParams(window.location.search).get("start_assistant_id")?.trim() || "";
  const voiceIdParam =
    new URLSearchParams(window.location.search).get("voiceId")?.trim() || "";
  // The user's single assistant ID (passed from the Expo app)
  const userAssistantId =
    new URLSearchParams(window.location.search).get("assistant_id")?.trim() || "";
    
  // Use user's assistant ID first, then query param, then early start, then fallback
  const isDeadFallback = ASSISTANT_ID?.trim() === "2135f31f-5c85-4517-9574-571a1b1d0e38";
  const defaultFallback = isDeadFallback ? "" : (ASSISTANT_ID?.trim() || "");

  const [isCallActive, setIsCallActive] = useState(false);
  const [currentAssistantId, setCurrentAssistantId] = useState<string>(
    userAssistantId || queryAssistantId || earlyStartAssistantId || defaultFallback,
  );
  const isVapiInitialized = useRef(false);

  const getInitialCalledToday = (): Set<string> => {
    const today = new Date().toISOString().split("T")[0];
    const storedDate = localStorage.getItem("callTrackingDate");
    const storedCalls = localStorage.getItem("calledToday");

    if (storedDate !== today) {
      localStorage.setItem("callTrackingDate", today);
      localStorage.setItem("calledToday", JSON.stringify([]));
      return new Set();
    }

    if (storedCalls) {
      try {
        return new Set(JSON.parse(storedCalls));
      } catch {
        return new Set();
      }
    }

    return new Set();
  };

  const calledTodayRef = useRef<Set<string>>(getInitialCalledToday());
  const isCallActiveRef = useRef(isCallActive);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  const startCallForAssistant = async (
    assistantId: string,
    sourceLabel: string,
  ) => {
    if (isCallActiveRef.current) {
      console.log(`Skipping ${sourceLabel}: call already in progress`);
      return;
    }

    const currentDate = new Date().toISOString().split("T")[0];
    calledTodayRef.current.add(assistantId);
    localStorage.setItem("calledToday", JSON.stringify([...calledTodayRef.current]));

    fetch(`${API_BASE_URL}/api/commands/called`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assistantId, date: currentDate }),
    }).catch((error) => {
      console.error("Failed to update last called date:", error);
    });

    try {
      setCurrentAssistantId(assistantId);
      await vapi.start(assistantId);
      console.log(`Call started from ${sourceLabel}`);
    } catch (error) {
      console.error("Failed to start call:", error);
    }
  };

  /**
   * Revert the assistant's system prompt back to the base master prompt.
   * Called when a conversation ends so the next call starts fresh.
   */
  const revertAssistantPrompt = async () => {
    const assistantToRevert = userAssistantId || currentAssistantId;
    if (!assistantToRevert) {
      console.warn("No assistant ID available to revert prompt");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/commands/revert-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant_id: assistantToRevert }),
      });
      if (response.ok) {
        console.log("Assistant prompt reverted to base");
      } else {
        console.warn("Failed to revert prompt:", response.status);
      }
    } catch (error) {
      console.warn("Error reverting prompt:", error);
    }
  };

  useEffect(() => {
    if (isVapiInitialized.current) {
      return;
    }

    isVapiInitialized.current = true;

    vapi.on("call-start", () => {
      setTimeout(() => {
        setIsCallActive(true);
      }, 1000);
    });

    vapi.on("call-end", () => {
      setIsCallActive(false);
      // Revert the system prompt when the conversation ends
      revertAssistantPrompt();
    });

    vapi.on("error", (error: any) => {
      console.error("Vapi error:", error);
      setIsCallActive(false);
    });

    return () => {
      vapi.stop();
    };
  }, []);

  useEffect(() => {
    const midnightReset = () => {
      calledTodayRef.current.clear();
    };

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const midnightTimeout = setTimeout(midnightReset, msUntilMidnight);

    const dayCheckInterval = setInterval(() => {
      const currentDate = new Date().toISOString().split("T")[0];
      const lastCheckDate = localStorage.getItem("lastCallDate");
      if (lastCheckDate && lastCheckDate !== currentDate) {
        calledTodayRef.current.clear();
        localStorage.setItem("lastCallDate", currentDate);
      }
    }, 60000);

    return () => {
      clearTimeout(midnightTimeout);
      clearInterval(dayCheckInterval);
    };
  }, []);

  const startCall = async () => {
    if (!currentAssistantId && !voiceIdParam) {
      return;
    }

    try {
      if (currentAssistantId) {
        await vapi.start(currentAssistantId);
      } else {
        await vapi.start({
          name: "Sonia AI",
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Sen, Sonia adında nazik ve yardımsever bir Tıbbi asistansın. Türkçe konuşuyorsun. İhtiyaç duyan hastalara yol gösteriyorsun."
              }
            ],
            maxTokens: 500,
          },
          voice: {
            provider: "11labs",
            voiceId: voiceIdParam,
          },
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "tr",
          },
          firstMessage: "Merhaba, ben yapay zekâ asistanınızım. Size nasıl yardımcı olabilirim?"
        });
      }
    } catch (error) {
      console.error("Failed to start call:", error);
    }
  };

  const endCall = () => {
    vapi.stop();
  };

  useEffect(() => {
    if (earlyCallFired) {
      return;
    }

    const startId =
      new URLSearchParams(window.location.search).get("start_assistant_id")?.trim() || "";

    if (!startId) {
      return;
    }

    startCallForAssistant(startId, "start_assistant_id query param").catch((error) => {
      console.error("Failed to start call from start_assistant_id:", error);
    });
  }, []);

  return (
    <main className="app-shell">
      <section className="panel">
        <header className="header">
          <h1>Phone</h1>
        </header>

        <div className="assistant-info">
          {currentAssistantId ? (
            <p className="status-text">Kullanılan Asistan: {currentAssistantId}</p>
          ) : voiceIdParam ? (
            <p className="status-text">
              Kullanılan Ses: {voiceIdParam} (Dinamik Asistan Oluşturuluyor)
            </p>
          ) : (
            <p className="status-text">
              Mevcut bir asistan bağlantısı veya ses kimliği bulunamadı.
            </p>
          )}
        </div>

        <div className="call-card">
          {!isCallActive ? (
            <button
              onClick={startCall}
              className="call-button"
              disabled={!currentAssistantId && !voiceIdParam}
            >
              Ara
            </button>
          ) : (
            <button onClick={endCall} className="call-button danger">
              Kapat
            </button>
          )}

          <p className="status-text">
            {isCallActive
              ? "Call is active."
              : "Press start to begin talking with your assistant."}
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
