import { Loader2, ShieldCheck, HeartPulse, Navigation } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

export interface EmergencySearchStateProps {
  situationLabel?: string;
  className?: string;
}

export const EmergencySearchState = ({
  situationLabel,
  className = '',
}: EmergencySearchStateProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={`flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-12 space-y-6 ${className}`}>
      {/* Animated Radar Pulse */}
      <div className="relative flex items-center justify-center w-20 h-20">
        {!shouldReduceMotion && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-slate-200"
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-2 rounded-full bg-slate-300"
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.8, delay: 0.4, ease: 'easeOut' }}
            />
          </>
        )}
        <div className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md relative z-10">
          <Loader2 className="w-6 h-6 animate-spin text-white" aria-hidden="true" />
        </div>
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          Finding suitable care nearby...
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Matching verified facilities with active emergency intake for{' '}
          <strong className="text-slate-800">{situationLabel ?? 'your situation'}</strong>.
        </p>
      </div>

      {/* Real-time Triage Verification Indicators */}
      <div className="w-full max-w-xs space-y-2 text-xs text-left bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <HeartPulse className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
          <span>Verifying 24/7 intake readiness</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>Confirming specialized capabilities</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Navigation className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
          <span>Calculating rapid arterial route</span>
        </div>
      </div>
    </div>
  );
};
