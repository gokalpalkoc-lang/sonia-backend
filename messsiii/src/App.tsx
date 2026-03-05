import { useEffect, useRef, useState } from "react";
import "./App.css";
import { API_BASE_URL, ASSISTANT_ID } from "./config";
import { vapi, earlyStartAssistantId, earlyCallFired } from "./vapi-instance";

function App() {
  const queryAssistantId =
    new URLSearchParams(window.location.search).get("start_assistant_id")?.trim() || "";
  const fallbackAssistantId = ASSISTANT_ID?.trim() || "";

  const [isCallActive, setIsCallActive] = useState(false);
  const [currentAssistantId, setCurrentAssistantId] = useState<string>(
    queryAssistantId || earlyStartAssistantId || fallbackAssistantId,
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
    if (!currentAssistantId) {
      return;
    }

    try {
      await vapi.start(currentAssistantId);
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
          <h1>Telefon et</h1>
        </header>

        <div className="assistant-info">
          {currentAssistantId ? (
            <p className="status-text">Using assistant: {currentAssistantId}</p>
          ) : (
            <p className="status-text">
              Missing `start_assistant_id` and no fallback assistant configured.
            </p>
          )}
        </div>

        <div className="call-card">
          {!isCallActive ? (
            <button
              onClick={startCall}
              className="call-button"
              disabled={!currentAssistantId}
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
