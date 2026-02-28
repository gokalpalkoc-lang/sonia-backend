import { lazy, Suspense, useEffect, useRef, useState } from "react";
import "./App.css";

// Lazy-load AssistantCreator — it's never shown on initial render,
// so keeping it out of the main bundle speeds up first paint.
const AssistantCreator = lazy(() => import("./AssistantCreator"));
import {
  API_BASE_URL,
  ASSISTANT_ID,
  VAPI_API_KEY,
} from "./config";
import { vapi, earlyStartAssistantId, earlyCallFired } from "./vapi-instance";

interface Assistant {
  id: string;
  name: string;
  createdAt: string;
}


function App() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentAssistantId, setCurrentAssistantId] = useState<string>(
    earlyStartAssistantId || "",
  );
  const [showCreator, setShowCreator] = useState(false);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(false);
  const [assistantName, setAssistantName] = useState("");
  const isVapiInitialized = useRef(false);

  // Initialize calledToday from localStorage or empty set
  const getInitialCalledToday = (): Set<string> => {
    const today = new Date().toISOString().split("T")[0];
    const storedDate = localStorage.getItem("callTrackingDate");
    const storedCalls = localStorage.getItem("calledToday");

    // If it's a new day, reset the tracking
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
  const isCallActiveRef = useRef(isCallActive); // Keep track of call status

  // Update refs when state changes
  // useEffect(() => {
  //   receivedCommandsRef.current = receivedCommands;
  // }, [receivedCommands]);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  const startCallForAssistant = async (
    assistantId: string,
    sourceLabel: string,
  ) => {
    if (isCallActiveRef.current) {
      console.log(`⏭️ Skipping ${sourceLabel} - call already in progress`);
      return;
    }

    const currentDate = new Date().toISOString().split("T")[0];
    calledTodayRef.current.add(assistantId);
    localStorage.setItem(
      "calledToday",
      JSON.stringify([...calledTodayRef.current]),
    );

    // Fire-and-forget — don't await the backend PUT before starting the call.
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
      console.log(`📞 Started call from ${sourceLabel}`);
    } catch (error) {
      console.error("Failed to start call:", error);
    }
  };

  // Fetch all assistants from VAPI
  const fetchAssistants = async () => {
    setIsLoadingAssistants(true);
    try {
      const response = await fetch("https://api.vapi.ai/assistant", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Map the response to Assistant interface
        const assistantList: Assistant[] = data.map((assistant: any) => ({
          id: assistant.id,
          name: assistant.name || "Adsız Asistan",
          createdAt: assistant.createdAt,
        }));
        setAssistants(assistantList);

        // Set currentAssistantId to first available assistant if the default one doesn't exist
        if (assistantList.length > 0 && !currentAssistantId) {
          const defaultExists = assistantList.some(
            (a) => a.id === ASSISTANT_ID,
          );
          setCurrentAssistantId(
            defaultExists ? ASSISTANT_ID : assistantList[0].id,
          );
        }
      } else {
        console.error("Failed to fetch assistants:", response.status);
      }
    } catch (error) {
      console.error("Error fetching assistants:", error);
    } finally {
      setIsLoadingAssistants(false);
    }
  };


  useEffect(() => {
    // Prevent multiple initializations (important for StrictMode in development)
    if (isVapiInitialized.current) {
      return;
    }
    isVapiInitialized.current = true;

    // Vapi was already created at module level (vapi-instance.ts).
    // Attach event listeners here.
    vapi.on("call-start", () => {
      console.log("Call started");
      setTimeout(() => {
        setIsCallActive(true);
      }, 1000); // Small delay to ensure UI updates properly
    });

    vapi.on("call-end", () => {
      console.log("Call ended");
      setIsCallActive(false);
    });

    vapi.on("error", (error: any) => {
      console.error("Vapi error:", error);
      setIsCallActive(false);
    });

    // Defer non-vital API calls so they don't compete with the early call.
    // requestIdleCallback (or setTimeout fallback) ensures they run after the
    // browser is idle / the call has had time to connect.
    const scheduleDeferred = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 500));
    scheduleDeferred(() => {
      fetchAssistants();

    });

    return () => {
      vapi.stop();
    };
  }, []);


  // Reset calledToday at midnight
  useEffect(() => {
    const midnightReset = () => {
      calledTodayRef.current.clear();
      console.log("🔄 Reset daily call tracking at midnight");
    };

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set timeout to reset at midnight
    const midnightTimeout = setTimeout(midnightReset, msUntilMidnight);

    // Also check periodically if we've crossed midnight
    const dayCheckInterval = setInterval(() => {
      const currentDate = new Date().toISOString().split("T")[0];
      const lastCheckDate = localStorage.getItem("lastCallDate");
      if (lastCheckDate && lastCheckDate !== currentDate) {
        calledTodayRef.current.clear();
        localStorage.setItem("lastCallDate", currentDate);
        console.log("🔄 Reset daily call tracking (date changed)");
      }
    }, 60000); // Check every minute

    return () => {
      clearTimeout(midnightTimeout);
      clearInterval(dayCheckInterval);
    };
  }, []);

  const startCall = async () => {
    try {
      await vapi.start(currentAssistantId);
    } catch (error) {
      console.error("Failed to start call:", error);
    }
  };

  const endCall = () => {
    vapi.stop();
  };

  const handleAssistantCreated = (assistantId: string) => {
    setCurrentAssistantId(assistantId);
    setShowCreator(false);
    // Refresh the assistants list
    fetchAssistants();
  };

  const handleAssistantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentAssistantId(e.target.value);
  };

  useEffect(() => {
    // If the early call was already fired at module level, skip.
    if (earlyCallFired) {
      console.log("⏭️ Skipping useEffect start — early call already fired");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const startId = params.get("start_assistant_id")?.trim();

    if (!startId) {
      return;
    }

    startCallForAssistant(
      startId,
      "start_assistant_id query param",
    ).catch((error) => {
      console.error("Failed to start call from start_assistant_id:", error);
    });
  }, []);

  const updateAssistantName = async () => {
    if (!assistantName.trim()) {
      alert("Lütfen bir asistan adı girin");
      return;
    }

    try {
      const response = await fetch(
        `https://api.vapi.ai/assistant/${currentAssistantId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${VAPI_API_KEY}`,
          },
          body: JSON.stringify({
            name: assistantName,
          }),
        },
      );

      if (response.ok) {
        alert("Asistan adı başarıyla güncellendi!");
        setAssistantName("");
        fetchAssistants();
      } else {
        alert("Asistan adı güncellenemedi");
      }
    } catch (error) {
      console.error("Asistan adı güncellenirken hata oluştu:", error);
      alert("Asistan adı güncellenirken hata oluştu");
    }
  };

  return (
    <>
      <div className="header">
        <h1>Vapi Asistanı</h1>
        <button
          onClick={() => setShowCreator(!showCreator)}
          className="toggle-button"
          style={{ display: "none" }}
        >
          {showCreator ? "Aramaya Dön" : "Yeni Asistan Oluştur"}
        </button>
      </div>

      {showCreator ? (
        <Suspense fallback={<p>Yükleniyor...</p>}>
          <AssistantCreator onAssistantCreated={handleAssistantCreated} />
        </Suspense>
      ) : (
        <div className="call-section">
          <div className="form-group">
            <label htmlFor="assistantSelect">Asistan Seçin:</label>
            {isLoadingAssistants ? (
              <p>Asistanlar yükleniyor...</p>
            ) : assistants.length > 0 ? (
              <select
                id="assistantSelect"
                value={currentAssistantId}
                onChange={handleAssistantChange}
                className="assistant-select"
              >
                {assistants.map((assistant) => (
                  <option key={assistant.id} value={assistant.id}>
                    {assistant.name}
                  </option>
                ))}
              </select>
            ) : (
              <p>Asistan bulunamadı. Önce bir tane oluşturun!</p>
            )}
            <button
              onClick={fetchAssistants}
              className="refresh-button"
              disabled={isLoadingAssistants}
            >
              {isLoadingAssistants ? "Yükleniyor..." : "Listeyi Yenile"}
            </button>
          </div>


          <div className="form-group">
            <label htmlFor="newAssistantName">Asistan Adını Güncelle:</label>
            <input
              id="newAssistantName"
              type="text"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              placeholder="Yeni asistan adını girin"
            />
            <button onClick={updateAssistantName} className="update-button">
              Adı Güncelle
            </button>
          </div>

          <div className="card">
            {!isCallActive ? (
              <button onClick={startCall}>Aramayı Başlat</button>
            ) : (
              <button onClick={endCall} style={{ backgroundColor: "#ff4444" }}>
                Aramayı Bitir
              </button>
            )}
            <p>
              {isCallActive
                ? "Arama aktif..."
                : "Vapi asistanınızla arama başlatmak için tıklayın"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
