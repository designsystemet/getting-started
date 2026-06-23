import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './style.css'

const appElement = document.querySelector('#app')
if (!appElement) throw new Error('Root element #app not found')

createRoot(appElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
