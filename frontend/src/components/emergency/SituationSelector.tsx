import { EMERGENCY_SITUATIONS } from '../../data/emergencySituations';
import type { EmergencySituationId } from '../../types/emergency';
import { SituationOption } from './SituationOption';
import { ArrowRight } from 'lucide-react';

export interface SituationSelectorProps {
  selectedSituation: EmergencySituationId | null;
  onSelectSituation: (id: EmergencySituationId) => void;
  onContinue: () => void;
  className?: string;
}

export const SituationSelector = ({
  selectedSituation,
  onSelectSituation,
  onContinue,
  className = '',
}: SituationSelectorProps) => {
  return (
    <div className={`space-y-8 flex-1 flex flex-col justify-between ${className}`}>
      <div className="space-y-6">
        {/* ─── 2. HERO HEADER & TRIAGE TYPOGRAPHY ───────────────────────── */}
        <div className="space-y-3">
          {/* Category Badge: Translucent crimson tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Emergency Triage</span>
          </div>

          {/* Title: Crisp, bold header */}
          <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">
            What are you experiencing?
          </h1>

          {/* Description: High-readability subtext */}
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xl font-normal">
            Select the situation so ResQ can identify verified facilities with matching clinical capabilities and open emergency intake.
          </p>
        </div>

        {/* ─── 3. SPACIOUS SITUATION SELECTION CARDS ────────────────────── */}
        <div
          role="radiogroup"
          aria-label="What are you experiencing"
          className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 pt-1"
        >
          {EMERGENCY_SITUATIONS.map((situation) => (
            <SituationOption
              key={situation.id}
              situation={situation}
              isSelected={selectedSituation === situation.id}
              onSelect={onSelectSituation}
            />
          ))}
        </div>
      </div>

      {/* ─── 4. BOTTOM STEP TRIGGER ─────────────────────────────────────── */}
      <div className="pt-6 sticky bottom-0 bg-[#070709]/85 backdrop-blur-xl py-4 border-t border-white/10 -mx-4 px-4 sm:mx-0 sm:px-0 z-20">
        <button
          type="button"
          disabled={!selectedSituation}
          onClick={onContinue}
          aria-label="Continue to location confirmation"
          className={`group relative overflow-hidden w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 px-6 text-sm font-semibold text-white transition-all duration-300 shadow-xl cursor-pointer ${
            selectedSituation
              ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 shadow-rose-950/60 hover:scale-[1.01] active:scale-[0.99] border border-rose-400/30'
              : 'bg-white/[0.04] text-zinc-500 border border-white/10 cursor-not-allowed opacity-50'
          }`}
        >
          {/* Hover sheen effect */}
          {selectedSituation && (
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          )}
          <span>Continue to Location</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};
