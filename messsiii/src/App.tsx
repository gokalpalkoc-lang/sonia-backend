import Vapi from "@vapi-ai/web";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import AssistantCreator from "./AssistantCreator";
import {
  API_BASE_URL,
  ASSISTANT_ID,
  VAPI_API_KEY,
  VAPI_PUBLIC_KEY,
} from "./config";

interface Assistant {
  id: string;
  name: string;
  createdAt: string;
}

interface Command {
  assistantName: string;
  time: string;
  prompt: string;
  firstMessage?: string;
  assistantId?: string;
}

function App() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentAssistantId, setCurrentAssistantId] = useState<string>(""); // Start empty, will be set after fetching assistants
  const [showCreator, setShowCreator] = useState(false);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(false);
  const [assistantName, setAssistantName] = useState("");
  // const [receivedCommands, setReceivedCommands] = useState<Command[]>([]);
  const vapiRef = useRef<Vapi | null>(null);
  const isVapiInitialized = useRef(false);
  // const lastCommandCount = useRef(0);

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
  const [refreshKey, setRefreshKey] = useState(0); // Force UI refresh

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
    setRefreshKey((k) => k + 1);

    try {
      await fetch(`${API_BASE_URL}/api/commands/called`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId, date: currentDate }),
      });
    } catch (error) {
      console.error("Failed to update last called date:", error);
    }

    if (!vapiRef.current) return;

    try {
      setCurrentAssistantId(assistantId);
      await vapiRef.current.start(assistantId);
      console.log(`📞 Started call from ${sourceLabel}`);
    } catch (error) {
      console.error("Failed to start call:", error);
    }
  };

  // Function to manually check time and trigger calls
  // const checkTimeNow = async () => {
  //   const now = new Date();
  //   const currentHours = now.getHours().toString().padStart(2, "0");
  //   const currentMinutes = now.getMinutes().toString().padStart(2, "0");
  //   const currentTime = `${currentHours}:${currentMinutes}`;
  //   console.log(`🔍 Manual time check: ${currentTime}`);

  //   for (const cmd of receivedCommands) {
  //     if (cmd.time === currentTime && cmd.assistantId) {
  //       if (calledTodayRef.current.has(cmd.assistantId)) {
  //         console.log(`⏭️ ${cmd.assistantName} - already called today`);
  //         continue;
  //       }
  //       if (isCallActive) {
  //         console.log(`⏭️ ${cmd.assistantName} - call in progress`);
  //         continue;
  //       }

  //       console.log(`📞 Calling ${cmd.assistantName}!`);
  //       await startCallForAssistant(
  //         cmd.assistantId,
  //         `manual time check (${cmd.assistantName})`,
  //       );
  //     }
  //   }
  // };

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
          name: assistant.name || "Unnamed Assistant",
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

  // Update assistant with first message (only if assistant exists)
  const updateAssistantFirstMessage = async (assistantId: string) => {
    try {
      const response = await fetch(
        `https://api.vapi.ai/assistant/${assistantId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${VAPI_API_KEY}`,
          },
          body: JSON.stringify({
            firstMessage: "Merhaba, nasılsın?",
            model: {
              maxTokens: 800,
            },
          }),
        },
      );

      if (response.ok) {
        console.log("Assistant first message updated successfully");
      } else {
        console.error(
          "Failed to update assistant first message:",
          response.status,
        );
      }
    } catch (error) {
      console.error("Error updating assistant first message:", error);
    }
  };

  useEffect(() => {
    // Prevent multiple initializations (important for StrictMode in development)
    if (isVapiInitialized.current) {
      return;
    }
    isVapiInitialized.current = true;

    // Initialize Vapi
    const vapi = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = vapi;

    // Fetch assistants on mount
    fetchAssistants();

    // Update assistant with first message if we have a valid assistant ID
    if (currentAssistantId) {
      updateAssistantFirstMessage(currentAssistantId);
    }

    // Vapi event listeners
    vapi.on("call-start", () => {
      console.log("Call started");
      setIsCallActive(true);
    });

    vapi.on("call-end", () => {
      console.log("Call ended");
      setIsCallActive(false);
    });

    vapi.on("error", (error: any) => {
      console.error("Vapi error:", error);
      setIsCallActive(false);
    });

    return () => {
      // Cleanup on unmount
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    };
  }, []);

  // // Poll for commands from the API
  // useEffect(() => {
  //   const pollCommands = async () => {
  //     try {
  //       const response = await fetch(`${API_BASE_URL}/api/commands`);
  //       if (response.ok) {
  //         const data = await response.json();
  //         console.log(data);
  //         if (
  //           data.commands &&
  //           data.commands.length > lastCommandCount.current
  //         ) {
  //           setReceivedCommands(data.commands);
  //           lastCommandCount.current = data.commands.length;
  //         }
  //       }
  //     } catch (error) {
  //       // Silently ignore polling errors
  //     }
  //   };

  //   // Poll every 2 seconds
  //   const interval = setInterval(pollCommands, 2000);
  //   return () => clearInterval(interval);
  // }, []);

  // Check time and trigger automatic calls
  // useEffect(() => {
  //   const checkTimeAndCall = async () => {
  //     // Get current time in HH:MM format (local time)
  //     const now = new Date();
  //     const currentHours = now.getHours().toString().padStart(2, "0");
  //     const currentMinutes = now.getMinutes().toString().padStart(2, "0");
  //     const currentTime = `${currentHours}:${currentMinutes}`;
  //     console.log(`⏰ Time check: ${currentTime}`);

  //     // Use ref for latest commands and call status
  //     const commands = receivedCommandsRef.current;
  //     const callActive = isCallActiveRef.current;

  //     // Check each command for time match
  //     for (const cmd of commands) {
  //       if (cmd.time === currentTime && cmd.assistantId) {
  //         // Check if already called today
  //         if (calledTodayRef.current.has(cmd.assistantId)) {
  //           console.log(
  //             `⏭️ Skipping ${cmd.assistantName} - already called today`,
  //           );
  //           continue;
  //         }

  //         // Check if call is already active to avoid duplicate calls
  //         if (callActive) {
  //           console.log(
  //             `⏭️ Skipping ${cmd.assistantName} - call already in progress`,
  //           );
  //           continue;
  //         }

  //         console.log(
  //           `📞 Starting automatic call for ${cmd.assistantName} at scheduled time ${cmd.time}!`,
  //         );
  //         await startCallForAssistant(
  //           cmd.assistantId,
  //           `scheduled command (${cmd.assistantName})`,
  //         );
  //       }
  //     }
  //   };

  //   // Check time every 30 seconds
  //   const timeInterval = setInterval(checkTimeAndCall, 30000);

  //   // Also run immediately on mount
  //   checkTimeAndCall();

  //   return () => clearInterval(timeInterval);
  // }, []);

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
    if (vapiRef.current) {
      try {
        await vapiRef.current.start(currentAssistantId);
      } catch (error) {
        console.error("Failed to start call:", error);
      }
    }
  };

  const endCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
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
    const params = new URLSearchParams(window.location.search);
    const startAssistantId = params.get("start_assistant_id")?.trim();

    if (!startAssistantId) {
      return;
    }

    startCallForAssistant(
      startAssistantId,
      "start_assistant_id query param",
    ).catch((error) => {
      console.error("Failed to start call from start_assistant_id:", error);
    });
  }, []);

  const updateAssistantName = async () => {
    if (!assistantName.trim()) {
      alert("Please enter an assistant name");
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
        alert("Assistant name updated successfully!");
        setAssistantName("");
        fetchAssistants();
      } else {
        alert("Failed to update assistant name");
      }
    } catch (error) {
      console.error("Error updating assistant name:", error);
      alert("Error updating assistant name");
    }
  };

  return (
    <>
      <div className="header">
        <h1>Vapi Assistant</h1>
        <button
          onClick={() => setShowCreator(!showCreator)}
          className="toggle-button"
          style={{ display: "none" }}
        >
          {showCreator ? "Back to Call" : "Create New Assistant"}
        </button>
      </div>

      {showCreator ? (
        <AssistantCreator onAssistantCreated={handleAssistantCreated} />
      ) : (
        <div className="call-section">
          <div className="form-group">
            <label htmlFor="assistantSelect">Select Assistant:</label>
            {isLoadingAssistants ? (
              <p>Loading assistants...</p>
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
              <p>No assistants found. Create one first!</p>
            )}
            <button
              onClick={fetchAssistants}
              className="refresh-button"
              disabled={isLoadingAssistants}
            >
              {isLoadingAssistants ? "Loading..." : "Refresh List"}
            </button>
          </div>

          {/* <div className="form-group">
            <label htmlFor="assistantId">Or enter Assistant ID manually:</label>
            <input
              id="assistantId"
              type="text"
              value={currentAssistantId}
              onChange={(e) => setCurrentAssistantId(e.target.value)}
              placeholder="Enter assistant ID"
            />
          </div> */}

          <div className="form-group">
            <label htmlFor="newAssistantName">Update Assistant Name:</label>
            <input
              id="newAssistantName"
              type="text"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              placeholder="Enter new assistant name"
            />
            <button onClick={updateAssistantName} className="update-button">
              Update Name
            </button>
          </div>

          <div className="card">
            {!isCallActive ? (
              <button onClick={startCall}>Start Call</button>
            ) : (
              <button onClick={endCall} style={{ backgroundColor: "#ff4444" }}>
                End Call
              </button>
            )}
            <p>
              {isCallActive
                ? "Call is active..."
                : "Click to start a call with your Vapi assistant"}
            </p>
          </div>

          {/* Commands from Sonia */}
          {/*<div className="commands-section">
            <div className="commands-header">
              <h2>📱 Commands from Sonia</h2>
              <button onClick={checkTimeNow} className="check-time-button">
                🔍 Check Time Now
              </button>
            </div>
            {receivedCommands.length === 0 ? (
              <p className="no-commands">
                No commands received yet. Add a command in the Sonia app!
              </p>
            ) : (
              <div className="commands-list" key={refreshKey}>
                {receivedCommands.map((cmd, index) => (
                  <div key={index} className="command-card">
                    <div className="command-header">
                      <span className="command-name">{cmd.assistantName}</span>
                      <span className="command-time">{cmd.time}</span>
                    </div>
                    <p className="command-prompt">
                      <strong>System Prompt:</strong> {cmd.prompt}
                    </p>
                    {cmd.firstMessage && (
                      <p className="command-first-message">
                        <strong>First Message:</strong> {cmd.firstMessage}
                      </p>
                    )}
                    {cmd.assistantId && (
                      <p className="command-id">
                        Assistant ID: {cmd.assistantId}
                      </p>
                    )}
                    {cmd.assistantId && (
                      <div className="command-auto-call">
                        {calledTodayRef.current.has(cmd.assistantId) ? (
                          <span className="auto-call-status called">
                            ✓ Called today
                          </span>
                        ) : (
                          <span className="auto-call-status pending">
                            ⏰ Auto-call enabled
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>*/}
        </div>
      )}
    </>
  );
}

export default App;
