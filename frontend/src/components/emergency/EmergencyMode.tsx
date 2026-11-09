import React from 'react';
import { Phone, X, ShieldAlert } from 'lucide-react';

export interface EmergencyModeProps {
  currentStepLabel?: string;
  stepNumber?: number;
  totalSteps?: number;
  onExit: () => void;
  children: React.ReactNode;
  className?: string;
}

export const EmergencyMode = ({
  currentStepLabel = 'Situation',
  stepNumber = 1,
  totalSteps = 5,
  onExit,
  children,
  className = '',
}: EmergencyModeProps) => {
  const handleCallEmergencyServices = () => {
    window.location.href = 'tel:112';
  };

  const progressPercent = Math.min(100, Math.max(0, (stepNumber / totalSteps) * 100));

  return (
    <div className={`min-h-screen bg-[#070709] text-zinc-100 flex flex-col font-sans antialiased selection:bg-rose-500/30 selection:text-white relative ${className}`}>
      {/* Background SVG Noise Grain Overlay & Soft Radial Glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025] z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-rose-600/10 blur-[140px] rounded-full z-0" />

      {/* ─── 1. TOP STEPPER BAR & EMERGENCY CONTROLS ─────────────────────── */}
      <header
        role="banner"
        aria-label="Emergency mode header"
        className="sticky top-0 z-40 bg-zinc-950/70 border-b border-white/10 backdrop-blur-md px-4 sm:px-8 py-4 shadow-2xl"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Exit Action & Emergency Mode Indicator */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit emergency mode"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Exit</span>
            </button>

            {/* Emergency Indicator: Pulsing red dot with crisp monospace font */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-rose-400 font-mono text-xs font-semibold tracking-wider uppercase">
                Emergency Mode
              </span>
            </div>
          </div>

          {/* Center: Progress Stepper (Tablet / Desktop) */}
          <div className="hidden sm:flex flex-col items-center gap-1.5">
            <span className="text-xs font-mono text-zinc-300 font-medium tracking-tight">
              Step {stepNumber}/{totalSteps} — {currentStepLabel}
            </span>
            <div className="w-36 md:w-48 bg-white/10 h-1 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.8)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Right: Direct Hotline Call (Illuminated Dark Glass Emergency Pill) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCallEmergencyServices}
              aria-label="Call emergency services at 112"
              className="inline-flex items-center gap-2 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600 hover:text-white transition-all shadow-lg shadow-rose-950/40 font-mono text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Call 112</span>
            </button>
          </div>
        </div>

        {/* Mobile Step Progress Stepper Bar */}
        <div className="sm:hidden mt-3 pt-3 border-t border-white/10 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>Step {stepNumber}/{totalSteps}</span>
            <strong className="text-zinc-200 font-semibold">{currentStepLabel}</strong>
          </div>
          <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Focused Workflow Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col relative z-10">
        {children}
      </main>

      {/* Persistent Medical Notice Footer */}
      <footer className="py-3.5 px-4 border-t border-white/10 bg-zinc-950/80 text-[11px] text-zinc-500 text-center relative z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
          <span>
            ResQ coordinates navigation & rapid clinical care access. Does not diagnose medical conditions. Always dial 112 for severe trauma.
          </span>
        </div>
      </footer>
    </div>
  );
};
