import { useMemo, useState } from 'react';
import { DEFAULT_MODEL, VAPI_API_KEY } from './config';

interface AssistantCreatorProps {
  onAssistantCreated?: (assistantId: string) => void;
}

function AssistantCreator({ onAssistantCreated }: AssistantCreatorProps) {
  const [prompt, setPrompt] = useState('');
  const [manualVoiceId, setManualVoiceId] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdAssistantId, setCreatedAssistantId] = useState('');

  const elevenLabsVoiceId = useMemo(() => {
    const voiceIdFromUrl = new URLSearchParams(window.location.search).get('voiceId');
    if (voiceIdFromUrl?.trim()) {
      return voiceIdFromUrl.trim();
    }

    return manualVoiceId.trim();
  }, [manualVoiceId]);


  const createAssistant = async () => {
    if (!prompt.trim()) {
      setError('Lütfen bir istem girin');
      return;
    }

    if (!elevenLabsVoiceId) {
      setError('Ses kimliği bulunamadı. Lütfen mobil uygulamada ses kurulumunu tamamlayın.');
      return;
    }

    if (!assistantName.trim()) {
      setError('Lütfen bir asistan adı girin');
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
            provider: 'deepgram',
            model: 'nova-2',
            language: 'tr',
          },
          firstMessage: 'Merhaba, nasılsın?',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Asistan oluşturulamadı');
      }

      const data = await response.json();
      setCreatedAssistantId(data.id);
      
      if (onAssistantCreated) {
        onAssistantCreated(data.id);
      }
    } catch (err: any) {
      setError(err.message || 'Asistan oluşturulurken bir hata oluştu');
      console.error('Error creating assistant:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="assistant-creator">
      <h2>Yeni Vapi Asistanı Oluştur</h2>
      
      <div className="form-group">
        <label htmlFor="assistantName">Asistan Adı:</label>
        <input
          id="assistantName"
          type="text"
          value={assistantName}
          onChange={(e) => setAssistantName(e.target.value)}
          placeholder="Asistan adını girin..."
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="prompt">Sistem İstemi:</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Yapay zekâ asistanınız için sistem istemini girin..."
          rows={4}
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="voiceId">ElevenLabs Ses Kimliği (mobil uygulamadan):</label>
        <input
          id="voiceId"
          type="text"
          value={elevenLabsVoiceId}
          onChange={(e) => setManualVoiceId(e.target.value)}
          placeholder="Ses kimliği Sonia mobil uygulaması web görünümünden aktarılır"
          disabled={isLoading || Boolean(new URLSearchParams(window.location.search).get('voiceId')?.trim())}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <button 
        onClick={createAssistant} 
        disabled={isLoading}
        className="create-button"
      >
        {isLoading ? 'Oluşturuluyor...' : 'Asistan Oluştur'}
      </button>

      {createdAssistantId && (
        <div className="success-message">
          <p>Asistan başarıyla oluşturuldu!</p>
          <p>Asistan Kimliği: <strong>{createdAssistantId}</strong></p>
          <p className="hint">Bu kimliği özel asistanınızla arama başlatmak için kullanabilirsiniz.</p>
        </div>
      )}
    </div>
  );
}

export default AssistantCreator;
