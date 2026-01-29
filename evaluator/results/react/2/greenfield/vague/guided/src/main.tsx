import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Import polyfills for modern web features
import 'interestfor'
import '@oddbird/popover-polyfill'
import '@oddbird/css-anchor-positioning'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
