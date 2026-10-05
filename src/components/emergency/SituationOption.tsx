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
      className={`group relative p-4 rounded-xl border text-left cursor-pointer transition-all select-none min-h-[64px] flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
        isSelected
          ? 'bg-slate-900 text-white border-slate-950 shadow-sm ring-1 ring-slate-900'
          : 'bg-white text-slate-900 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs'
      } ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? 'bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
          }`}
        >
          {renderSituationIcon(situation.id, 'w-5 h-5 shrink-0')}
        </div>

        <div className="min-w-0">
          <span
            className={`font-semibold text-sm sm:text-base block truncate ${
              isSelected ? 'text-white' : 'text-slate-900'
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
          <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />
        ) : (
          <Circle className="w-5 h-5 text-slate-300 group-hover:text-slate-400" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};
