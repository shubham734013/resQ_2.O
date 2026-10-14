import {
  Heart,
  Activity,
  AlertTriangle,
  Flame,
  ShieldAlert,
  HelpCircle,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import type { EmergencySituation, EmergencySituationId } from '../../types/emergency';

export interface SituationOptionProps {
  situation: EmergencySituation;
  isSelected: boolean;
  onSelect: (id: EmergencySituationId) => void;
  className?: string;
}

function renderSituationIcon(id: EmergencySituationId, className: string) {
  switch (id) {
    case 'chest_pain':
      return <Heart className={className} aria-hidden="true" />;
    case 'breathing_difficulty':
      return <Activity className={className} aria-hidden="true" />;
    case 'stroke_symptoms':
      return <Activity className={className} aria-hidden="true" />;
    case 'severe_bleeding':
    case 'accident_injury':
      return <AlertTriangle className={className} aria-hidden="true" />;
    case 'burn':
      return <Flame className={className} aria-hidden="true" />;
    case 'unconscious_person':
      return <ShieldAlert className={className} aria-hidden="true" />;
    case 'other':
    default:
      return <HelpCircle className={className} aria-hidden="true" />;
  }
}

export const SituationOption = ({
  situation,
  isSelected,
  onSelect,
  className = '',
}: SituationOptionProps) => {
  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(situation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(situation.id);
        }
      }}
      className={`group relative p-4 rounded-xl border text-left cursor-pointer transition-all select-none min-h-[68px] flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
        isSelected
          ? 'bg-gradient-to-r from-slate-950 to-slate-900 text-white border-teal-500 shadow-md ring-2 ring-teal-500/25'
          : 'bg-white text-slate-900 border-slate-200/90 hover:border-teal-300 hover:bg-slate-50/70 shadow-xs'
      } ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? 'bg-teal-950/80 text-teal-300 border border-teal-500/30'
              : 'bg-slate-100 text-slate-700 group-hover:bg-teal-50 group-hover:text-teal-700'
          }`}
        >
          {renderSituationIcon(situation.id, 'w-5 h-5 shrink-0')}
        </div>

        <div className="min-w-0">
          <span
            className={`font-bold text-sm sm:text-base block truncate ${
              isSelected ? 'text-white' : 'text-slate-950'
            }`}
          >
            {situation.label}
          </span>
          <span
            className={`text-xs block truncate mt-0.5 ${
              isSelected ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            {situation.description}
          </span>
        </div>
      </div>

      <div className="shrink-0 pl-2">
        {isSelected ? (
          <CheckCircle2 className="w-5 h-5 text-teal-400" aria-hidden="true" />
        ) : (
          <Circle className="w-5 h-5 text-slate-300 group-hover:text-teal-500/50" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};
