import Vapi from '@vapi-ai/web';
import { useEffect, useRef, useState } from 'react';
import './App.css';
import { ASSISTANT_ID, VAPI_PUBLIC_KEY } from './config';

function App() {
  const [isCallActive, setIsCallActive] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => {
    // Initialize Vapi
    const vapi = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = vapi;

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
        await vapiRef.current.start(ASSISTANT_ID);
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

  return (
    <>
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
    </>
  )
}

export default App
