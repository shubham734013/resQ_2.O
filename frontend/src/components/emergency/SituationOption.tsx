import {
  Heart,
  Activity,
  AlertTriangle,
  Flame,
  ShieldAlert,
  HelpCircle,
  Wind,
  Check,
  Droplets,
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
      return <Wind className={className} aria-hidden="true" />;
    case 'stroke_symptoms':
      return <Activity className={className} aria-hidden="true" />;
    case 'severe_bleeding':
      return <Droplets className={className} aria-hidden="true" />;
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
      className={`group relative p-6 rounded-2xl border text-left cursor-pointer transition-all duration-300 select-none min-h-[96px] flex items-center justify-between gap-4 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
        isSelected
          ? 'border-rose-500 bg-rose-500/10 shadow-[0_0_25px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/40'
          : 'bg-white/[0.03] border-white/10 hover:border-rose-500/40 hover:bg-rose-500/[0.04]'
      } ${className}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        {/* Dark glass glowing icon badge */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-300 ${
            isSelected
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20 group-hover:bg-rose-500/15 group-hover:text-rose-300'
          }`}
        >
          {renderSituationIcon(situation.id, 'w-6 h-6 shrink-0')}
        </div>

        <div className="min-w-0">
          <span
            className={`font-bold text-base block truncate tracking-tight transition-colors ${
              isSelected ? 'text-white' : 'text-zinc-100 group-hover:text-white'
            }`}
          >
            {situation.label}
          </span>
          <span
            className={`text-xs block line-clamp-2 mt-1 leading-relaxed transition-colors ${
              isSelected ? 'text-zinc-300' : 'text-zinc-400 group-hover:text-zinc-300'
            }`}
          >
            {situation.description}
          </span>
        </div>
      </div>

      {/* Filled radio indicator when selected, subtle dark ring when unselected */}
      <div className="shrink-0 pl-2">
        <div
          className={`h-6 w-6 rounded-full flex items-center justify-center transition-all duration-200 ${
            isSelected
              ? 'bg-rose-500 text-white shadow-md shadow-rose-950/80 ring-2 ring-rose-400/40 scale-105'
              : 'border border-white/20 bg-white/[0.02] group-hover:border-rose-500/40'
          }`}
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
};
