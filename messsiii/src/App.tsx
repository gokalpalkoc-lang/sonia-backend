import Vapi from '@vapi-ai/web';
import { useEffect, useRef, useState } from 'react';
import './App.css';
import AssistantCreator from './AssistantCreator';
import { ASSISTANT_ID, VAPI_API_KEY, VAPI_PUBLIC_KEY } from './config';

interface Assistant {
  id: string;
  name: string;
  createdAt: string;
}

function App() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentAssistantId, setCurrentAssistantId] = useState(ASSISTANT_ID);
  const [showCreator, setShowCreator] = useState(false);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(false);
  const [assistantName, setAssistantName] = useState('');
  const vapiRef = useRef<Vapi | null>(null);
  const isVapiInitialized = useRef(false);

  // Fetch all assistants from VAPI
  const fetchAssistants = async () => {
    setIsLoadingAssistants(true);
    try {
      const response = await fetch('https://api.vapi.ai/assistant', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Map the response to Assistant interface
        const assistantList: Assistant[] = data.map((assistant: any) => ({
          id: assistant.id,
          name: assistant.name || 'Unnamed Assistant',
          createdAt: assistant.createdAt,
        }));
        setAssistants(assistantList);
      } else {
        console.error('Failed to fetch assistants:', response.status);
      }
    } catch (error) {
      console.error('Error fetching assistants:', error);
    } finally {
      setIsLoadingAssistants(false);
    }
  };

  // Update assistant with first message
  const updateAssistantFirstMessage = async () => {
    try {
      const response = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VAPI_API_KEY}`,
        },
        body: JSON.stringify({
          firstMessage: 'Merhaba, nasılsın?',
          model: {
            maxTokens: 800,
          },
        }),
      });

      if (response.ok) {
        console.log('Assistant first message updated successfully');
      } else {
        console.error('Failed to update assistant first message:', response.status);
      }
    } catch (error) {
      console.error('Error updating assistant first message:', error);
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

    // Update assistant with first message
    updateAssistantFirstMessage();

    // Vapi event listeners
    vapi.on('call-start', () => {
      console.log('Call started');
      setIsCallActive(true);
    });

    vapi.on('call-end', () => {
      console.log('Call ended');
      setIsCallActive(false);
    });

    vapi.on('error', (error: any) => {
      console.error('Vapi error:', error);
      setIsCallActive(false);
    });

    return () => {
      // Cleanup on unmount
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    };
  }, []);

  const startCall = async () => {
    if (vapiRef.current) {
      try {
        await vapiRef.current.start(currentAssistantId);
      } catch (error) {
        console.error('Failed to start call:', error);
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

  const updateAssistantName = async () => {
    if (!assistantName.trim()) {
      alert('Please enter an assistant name');
      return;
    }

    try {
      const response = await fetch(`https://api.vapi.ai/assistant/${currentAssistantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VAPI_API_KEY}`,
        },
        body: JSON.stringify({
          name: assistantName,
        }),
      });

      if (response.ok) {
        alert('Assistant name updated successfully!');
        setAssistantName('');
        fetchAssistants();
      } else {
        alert('Failed to update assistant name');
      }
    } catch (error) {
      console.error('Error updating assistant name:', error);
      alert('Error updating assistant name');
    }
  };

  return (
    <>
      <div className="header">
        <h1>Vapi Assistant</h1>
        <button 
          onClick={() => setShowCreator(!showCreator)}
          className="toggle-button"
        >
          {showCreator ? 'Back to Call' : 'Create New Assistant'}
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
              {isLoadingAssistants ? 'Loading...' : 'Refresh List'}
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="assistantId">Or enter Assistant ID manually:</label>
            <input
              id="assistantId"
              type="text"
              value={currentAssistantId}
              onChange={(e) => setCurrentAssistantId(e.target.value)}
              placeholder="Enter assistant ID"
            />
          </div>

          <div className="form-group">
            <label htmlFor="newAssistantName">Update Assistant Name:</label>
            <input
              id="newAssistantName"
              type="text"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              placeholder="Enter new assistant name"
            />
            <button 
              onClick={updateAssistantName} 
              className="update-button"
            >
              Update Name
            </button>
          </div>

          <div className="card">
            {!isCallActive ? (
              <button onClick={startCall}>
                Start Call
              </button>
            ) : (
              <button onClick={endCall} style={{ backgroundColor: '#ff4444' }}>
                End Call
              </button>
            )}
            <p>{isCallActive ? 'Call is active...' : 'Click to start a call with your Vapi assistant'}</p>
          </div>
        </div>
      )}
    </>
  )
}

export default App
