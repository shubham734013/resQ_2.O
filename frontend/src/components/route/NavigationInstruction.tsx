import {
  ArrowUp,
  CornerUpRight,
  CornerUpLeft,
  ArrowUpRight,
  ArrowUpLeft,
  RotateCcw,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import type { NavigationInstruction as NavInstructionType, ManeuverType } from '../../types/route';

export interface NavigationInstructionProps {
  currentInstruction: NavInstructionType;
  nextInstruction?: NavInstructionType;
  destinationName: string;
  isEmergency?: boolean;
  className?: string;
}

const getManeuverIcon = (maneuver: ManeuverType) => {
  const iconProps = { className: 'w-7 h-7 sm:w-8 sm:h-8 text-white stroke-[2.5]' };
  switch (maneuver) {
    case 'turn-right':
      return <CornerUpRight {...iconProps} />;
    case 'turn-left':
      return <CornerUpLeft {...iconProps} />;
    case 'slight-right':
      return <ArrowUpRight {...iconProps} />;
    case 'slight-left':
      return <ArrowUpLeft {...iconProps} />;
    case 'u-turn':
      return <RotateCcw {...iconProps} />;
    case 'arrive':
      return <MapPin {...iconProps} className="w-7 h-7 sm:w-8 sm:h-8 text-rose-400 stroke-[2.5]" />;
    case 'straight':
    default:
      return <ArrowUp {...iconProps} />;
  }
};

export const NavigationInstruction = ({
  currentInstruction,
  nextInstruction,
  destinationName,
  isEmergency = false,
  className = '',
}: NavigationInstructionProps) => {
  return (
    <div
      role="banner"
      aria-live="polite"
      aria-label={`Navigation instruction: ${currentInstruction.instruction}`}
      className={`bg-slate-950 text-white rounded-2xl shadow-2xl border border-slate-800 p-4 sm:p-5 backdrop-blur-md ${className}`}
    >
      {/* Emergency Header if applicable */}
      {isEmergency && (
        <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800 text-rose-400 text-xs font-semibold">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Priority Emergency Route &bull; {destinationName}</span>
        </div>
      )}

      <div className="flex items-center gap-4 sm:gap-5">
        {/* Maneuver Icon in high-contrast badge */}
        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-blue-600/90 border border-blue-400/30 flex items-center justify-center shrink-0 shadow-inner">
          {getManeuverIcon(currentInstruction.maneuver)}
        </div>

        {/* Big Distance & Street Direction Instruction */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {currentInstruction.distanceToNext}
            </span>
            <span className="text-xs sm:text-sm font-medium text-slate-400 truncate">
              to {currentInstruction.streetName}
            </span>
          </div>
          <p className="text-sm sm:text-base font-bold text-slate-100 truncate mt-0.5">
            {currentInstruction.instruction}
          </p>
        </div>
      </div>

      {/* Next Upcoming Instruction Hint */}
      {nextInstruction && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500">
              Then:
            </span>
            <span className="truncate text-slate-300 font-medium">
              {nextInstruction.instruction}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-slate-400 pl-2">
            {nextInstruction.distanceToNext}
          </span>
        </div>
      )}
    </div>
  );
};
