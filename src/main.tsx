import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Keep the platform-specific CJK choice in CSS while avoiding a font flash
// caused by waiting for React to mount first.
document.documentElement.classList.toggle(
  'wl-windows',
  /Windows/i.test(navigator.userAgent),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
