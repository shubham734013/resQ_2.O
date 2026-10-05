import React from 'react';
import { Phone, X, ShieldAlert } from 'lucide-react';
import { Button } from '../common/Button';

export interface EmergencyModeProps {
  currentStepLabel?: string;
  stepNumber?: number;
  totalSteps?: number;
  onExit: () => void;
  children: React.ReactNode;
  className?: string;
}

export const EmergencyMode = ({
  currentStepLabel,
  stepNumber,
  totalSteps = 4,
  onExit,
  children,
  className = '',
}: EmergencyModeProps) => {
  const handleCall911 = () => {
    window.location.href = 'tel:911';
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased ${className}`}>
      {/* Streamlined Emergency Header */}
      <header
        role="banner"
        aria-label="Emergency mode header"
        className="bg-white border-b border-slate-200/90 sticky top-0 z-40 px-4 sm:px-6 py-3 shadow-xs"
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Exit Action & Mode Indicator */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit emergency mode"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Exit</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
              <span className="font-bold text-slate-950 text-sm tracking-tight">
                Emergency Mode
              </span>
            </div>
          </div>

          {/* Center: Step Progress (Tablet/Desktop) */}
          {stepNumber && totalSteps && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Step {stepNumber} of {totalSteps}</span>
              {currentStepLabel && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-700 font-semibold">{currentStepLabel}</span>
                </>
              )}
            </div>
          )}

          {/* Right: Quick 911 Call Link */}
          <div className="flex items-center gap-2">
            <Button
              variant="emergency"
              size="sm"
              icon={<Phone className="w-3.5 h-3.5 text-white" aria-hidden="true" />}
              onClick={handleCall911}
              aria-label="Call emergency dispatch 911 immediately"
              className="tracking-tight text-xs font-semibold py-1.5 px-3"
            >
              <span>Call 911</span>
            </Button>
          </div>
        </div>

        {/* Mobile Step Progress Bar */}
        {stepNumber && totalSteps && (
          <div className="sm:hidden mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Step {stepNumber} of {totalSteps}: <strong className="text-slate-800">{currentStepLabel}</strong></span>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i + 1 <= stepNumber ? 'w-4 bg-slate-900' : 'w-2 bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Focused Workflow Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {children}
      </main>

      {/* Persistent Medical Notice Footer */}
      <footer className="py-3 px-4 border-t border-slate-200/80 bg-white text-[11px] text-slate-500 text-center">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <span>
            ResQ coordinates navigation & care access. Does not diagnose medical conditions.
          </span>
        </div>
      </footer>
    </div>
  );
};
