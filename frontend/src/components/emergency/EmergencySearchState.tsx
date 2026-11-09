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
    <div className={`flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-12 space-y-8 ${className}`}>
      {/* Animated Radar Pulse in Deep Dark Obsidian */}
      <div className="relative flex items-center justify-center w-24 h-24">
        {!shouldReduceMotion && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-rose-500/20"
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-2 rounded-full bg-rose-500/30"
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.4, ease: 'easeOut' }}
            />
          </>
        )}
        <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-2xl shadow-rose-950/80 relative z-10 border border-rose-400/30">
          <Loader2 className="w-7 h-7 animate-spin text-white" aria-hidden="true" />
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span>Real-time Triage Query</span>
        </div>
        <h2 className="text-2xl font-light text-zinc-100 tracking-tight">
          Finding suitable care nearby...
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
          Matching verified facilities with active emergency intake for{' '}
          <strong className="text-rose-300 font-semibold">{situationLabel ?? 'your situation'}</strong>.
        </p>
      </div>

      {/* Real-time Triage Verification Indicators in Dark Glass Card */}
      <div className="w-full max-w-sm space-y-3 text-xs text-left bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-3 text-zinc-300">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
            <HeartPulse className="w-4 h-4" aria-hidden="true" />
          </div>
          <span>Verifying 24/7 intake readiness & capacity</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-300">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          </div>
          <span>Confirming specialized clinical capabilities</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-300">
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
            <Navigation className="w-4 h-4" aria-hidden="true" />
          </div>
          <span>Calculating rapid arterial route & driving ETA</span>
        </div>
      </div>
    </div>
  );
};
