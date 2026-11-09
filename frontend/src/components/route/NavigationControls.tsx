import {
  Phone,
  X,
  LocateFixed,
  Clock,
  Navigation,
} from 'lucide-react';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';

export interface NavigationControlsProps {
  remainingTime: string;
  remainingDistance: string;
  etaTime: string;
  facilityName: string;
  facilityPhone: string;
  currentStepIndex: number;
  totalSteps: number;
  onNextStep: () => void;
  onRecenter: () => void;
  onCallFacility: () => void;
  onEndNavigation: () => void;
  isEmergency?: boolean;
  className?: string;
}

export const NavigationControls = ({
  remainingTime,
  remainingDistance,
  etaTime,
  facilityName,
  facilityPhone,
  currentStepIndex,
  totalSteps,
  onNextStep,
  onRecenter,
  onCallFacility,
  onEndNavigation,
  isEmergency = false,
  className = '',
}: NavigationControlsProps) => {
  return (
    <div
      role="region"
      aria-label="Navigation controls"
      className={`bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5 ${className}`}
    >
      {/* Top Row: Metric Readouts (Remaining Time, ETA, Distance) */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            {remainingTime}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>ETA {etaTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-right">
          <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
            <Navigation className="w-3.5 h-3.5 text-slate-500" />
            <span>{remainingDistance}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline-block">
            Step {currentStepIndex + 1}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Facility Name & Quick Call / Recenter */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            {isEmergency ? 'Emergency Destination' : 'Heading To'}
          </span>
          <p className="font-semibold text-slate-900 truncate text-sm">
            {facilityName}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <IconButton
            icon={<LocateFixed className="w-4 h-4 text-slate-700" />}
            size="md"
            variant="default"
            aria-label="Recenter map"
            onClick={onRecenter}
          />
          <IconButton
            icon={<Phone className="w-4 h-4 text-slate-700" />}
            size="md"
            variant="default"
            aria-label={`Call facility ${facilityName} at ${facilityPhone}`}
            onClick={onCallFacility}
          />
        </div>
      </div>

      {/* Operational navigation controls */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
        <div className="sm:col-span-4">
          <Button
            variant="outline"
            size="md"
            fullWidth
            icon={<X className="w-4 h-4 text-rose-600" />}
            onClick={onEndNavigation}
            aria-label="End navigation"
            className="text-rose-700 hover:text-rose-800 hover:border-rose-300 font-semibold"
          >
            End navigation
          </Button>
        </div>

        <div className="sm:col-span-8">
          <Button
            variant={currentStepIndex + 1 >= totalSteps ? 'primary' : 'secondary'}
            size="md"
            fullWidth
            onClick={onNextStep}
            aria-label={currentStepIndex + 1 >= totalSteps ? 'Arrive at destination' : 'Advance to next navigation instruction'}
          >
            {currentStepIndex + 1 >= totalSteps ? 'Arrive at destination' : 'Next instruction'}
          </Button>
        </div>
      </div>
    </div>
  );
};
