import { EMERGENCY_SITUATIONS } from '../../data/emergencySituations';
import type { EmergencySituationId } from '../../types/emergency';
import { SituationOption } from './SituationOption';
import { Button } from '../common/Button';
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
    <div className={`space-y-6 flex-1 flex flex-col justify-between ${className}`}>
      <div className="space-y-4">
        {/* Title & Guidance */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200/60 text-rose-800 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            <span>Emergency Triage</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
            What are you experiencing?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
            Select the situation so ResQ can identify verified facilities with matching clinical capabilities and open emergency intake.
          </p>
        </div>

        {/* Options Radiogroup */}
        <div
          role="radiogroup"
          aria-label="What are you experiencing"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1"
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

      {/* Sticky/Fixed Bottom Continue Action */}
      <div className="pt-4 sticky bottom-0 bg-slate-50/95 backdrop-blur-md py-3 border-t border-slate-200/90 -mx-4 px-4 sm:mx-0 sm:px-0 z-20">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!selectedSituation}
          onClick={onContinue}
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          aria-label="Continue to location confirmation"
          className="shadow-sm font-bold"
        >
          Continue to Location
        </Button>
      </div>
    </div>
  );
};
