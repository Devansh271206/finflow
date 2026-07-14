import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#111827',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '14px',
          fontSize: '13px'
        }
      }}
    />
  </StrictMode>,
)
