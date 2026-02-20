import { useState } from 'react';
import { DEFAULT_MODEL, VAPI_API_KEY } from './config';

interface AssistantCreatorProps {
  onAssistantCreated?: (assistantId: string) => void;
}

function AssistantCreator({ onAssistantCreated }: AssistantCreatorProps) {
  const [prompt, setPrompt] = useState('');
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdAssistantId, setCreatedAssistantId] = useState('');

  const createAssistant = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    if (!elevenLabsVoiceId.trim()) {
      setError('Please enter an ElevenLabs voice ID');
      return;
    }

    if (!assistantName.trim()) {
      setError('Please enter an assistant name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VAPI_API_KEY}`,
        },
        body: JSON.stringify({
          name: assistantName,
          model: {
            provider: 'openai',
            model: DEFAULT_MODEL,
            systemPrompt: prompt,
            maxTokens: 800,
          },
          voice: {
            provider: '11labs',
            voiceId: elevenLabsVoiceId,
          },
          transcriber: {
            provider: '11labs',
            language: 'tr',
          },
          firstMessage: 'Merhaba, nasılsın?',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create assistant');
      }

      const data = await response.json();
      setCreatedAssistantId(data.id);
      
      if (onAssistantCreated) {
        onAssistantCreated(data.id);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the assistant');
      console.error('Error creating assistant:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="assistant-creator">
      <h2>Create New Vapi Assistant</h2>
      
      <div className="form-group">
        <label htmlFor="assistantName">Assistant Name:</label>
        <input
          id="assistantName"
          type="text"
          value={assistantName}
          onChange={(e) => setAssistantName(e.target.value)}
          placeholder="Enter the assistant name..."
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="prompt">System Prompt:</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter the system prompt for your AI assistant..."
          rows={4}
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="voiceId">ElevenLabs Voice ID:</label>
        <input
          id="voiceId"
          type="text"
          value={elevenLabsVoiceId}
          onChange={(e) => setElevenLabsVoiceId(e.target.value)}
          placeholder="Enter your ElevenLabs voice ID (e.g., rachel, adam, etc.)"
          disabled={isLoading}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <button 
        onClick={createAssistant} 
        disabled={isLoading}
        className="create-button"
      >
        {isLoading ? 'Creating...' : 'Create Assistant'}
      </button>

      {createdAssistantId && (
        <div className="success-message">
          <p>Assistant created successfully!</p>
          <p>Assistant ID: <strong>{createdAssistantId}</strong></p>
          <p className="hint">You can use this ID to start calls with your custom assistant.</p>
        </div>
      )}
    </div>
  );
}

export default AssistantCreator;
