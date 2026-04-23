// Import vapi-instance FIRST so Vapi is created and the early call fires
// before React even begins rendering.
import './vapi-instance'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
