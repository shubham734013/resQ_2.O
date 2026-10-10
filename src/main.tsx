import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Application Error" fallbackDescription="ResQ encountered a startup or layout problem. You can reload the application.">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
