import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Analytics } from '@vercel/analytics/react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {new URLSearchParams(window.location.search).get("embed") !== "1" && <Analytics />}
  </StrictMode>,
)


