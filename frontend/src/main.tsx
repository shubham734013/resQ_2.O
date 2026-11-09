import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import Lenis from 'lenis'

// ─── Lenis smooth scrolling ───────────────────────────────────────────────────
const LenisWrapper = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    const rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      fallbackTitle="Application Error"
      fallbackDescription="ResQ encountered a startup or layout problem. You can reload the application."
    >
      <LenisWrapper>
        <App />
      </LenisWrapper>
    </ErrorBoundary>
  </StrictMode>,
)
