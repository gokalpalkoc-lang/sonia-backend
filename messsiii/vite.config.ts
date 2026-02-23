import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig, type ViteDevServer } from 'vite';

// Vapi API configuration
const VAPI_API_KEY = "475a65ff-0aa5-4dac-b9f2-52a16f2c7bba";
const ELEVENLABS_VOICE_ID = "Mh8FUpRrhM4iDFS1KYre";

// Store commands in memory
let storedCommands: Array<{ assistantName: string; time: string; prompt: string; firstMessage?: string; assistantId?: string }> = [];

// Track when each assistant was last called (keyed by assistantId)
// Format: { assistantId: "2026-02-23" } - stores the date last called
const lastCalledDates: Record<string, string> = {};

// Custom plugin to handle API commands from sonia
const apiCommandPlugin = (): Plugin => {
  return {
    name: 'api-command-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/commands', async (req, res) => {
        // Handle GET request - return stored commands
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ commands: storedCommands }))
          return
        }

        // Handle POST request - create assistant and store command
        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => {
            body += chunk.toString()
          })
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const { assistantName, time, prompt, firstMessage } = data
              
              console.log('📱 Command received from Sonia:')
              console.log('   Assistant Name:', assistantName)
              console.log('   Time:', time)
              console.log('   System Prompt:', prompt)
              console.log('   First Message:', firstMessage)

              // Create assistant with Vapi API
              let assistantId = null;
              try {
                const createAssistantResponse = await fetch('https://api.vapi.ai/assistant', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${VAPI_API_KEY}`,
                  },
                  body: JSON.stringify({
                    name: assistantName,
                    model: {
                      provider: 'openai',
                      model: 'gpt-5-mini',
                      systemPrompt: prompt,
                      maxTokens: 800,
                    },
                    voice: {
                      provider: '11labs',
                      voiceId: ELEVENLABS_VOICE_ID,
                    },
                    transcriber: {
                      provider: '11labs',
                      language: 'tr',
                    },
                    firstMessage: firstMessage,
                  }),
                });

                if (createAssistantResponse.ok) {
                  const assistantData = await createAssistantResponse.json() as { id: string };
                  assistantId = assistantData.id;
                  console.log('✅ Created new assistant:', assistantId);
                } else {
                  console.error('Failed to create assistant:', createAssistantResponse.status);
                }
              } catch (error) {
                console.error('Error creating assistant:', error);
              }
              
              // Store the command
              storedCommands.push({ 
                assistantName, 
                time, 
                prompt,
                firstMessage,
                assistantId: assistantId || undefined
              })
              
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ 
                success: true, 
                message: 'Command received and assistant created',
                assistantId 
              }))
            } catch (error) {
              console.error('Error parsing command:', error)
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }))
            }
          })
          return
        }
        
        // Handle PUT request - update last called date for an assistant
        if (req.method === 'PUT' && (req.url === '/called' || req.url === '/api/commands/called')) {
          let body = ''
          req.on('data', chunk => {
            body += chunk.toString()
          })
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              const { assistantId, date } = data
              
              if (assistantId && date) {
                lastCalledDates[assistantId] = date
                console.log(`📅 Updated last called date for ${assistantId}: ${date}`)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true }))
              } else {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, error: 'Missing assistantId or date' }))
              }
            } catch (error) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }))
            }
          })
          return
        }
        
        // Handle GET request for last called date
        if (req.method === 'GET' && (req.url?.startsWith('/last-called/') || req.url?.startsWith('/api/commands/last-called/'))) {
          const assistantId = req.url.split('/').pop()
          const lastCalled = assistantId ? lastCalledDates[assistantId] : null
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ lastCalledDate: lastCalled }))
          return
        }
        
        // Method not allowed for unhandled routes
        res.writeHead(405, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Method not allowed' }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiCommandPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
})
