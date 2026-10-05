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
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
            What are you experiencing?
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Select the situation to identify facilities with verified matching capabilities.
          </p>
        </div>

        {/* Options Radiogroup */}
        <div
          role="radiogroup"
          aria-label="What are you experiencing"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1"
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
      <div className="pt-6 sticky bottom-0 bg-slate-50/95 backdrop-blur-xs py-3 border-t border-slate-200/80 -mx-4 px-4 sm:mx-0 sm:px-0">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!selectedSituation}
          onClick={onContinue}
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          aria-label="Continue to location confirmation"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};
