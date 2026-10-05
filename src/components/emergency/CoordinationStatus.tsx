import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Navigation,
  Phone,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { Facility } from '../../types/facility';
import { Button } from '../common/Button';

export interface CoordinationStatusProps {
  facility: Facility;
  onExit: () => void;
  className?: string;
}

interface StepItem {
  id: string;
  label: string;
  detail: string;
}

const STEPS: StepItem[] = [
  {
    id: 'finding_care',
    label: 'Finding care',
    detail: 'Matching clinical capabilities & verified intake readiness.',
  },
  {
    id: 'facility_selected',
    label: 'Facility selected',
    detail: 'Destination confirmed with verified emergency intake.',
  },
  {
    id: 'preparing_notification',
    label: 'Preparing notification',
    detail: 'Hospital notification will be available when connected to ResQ services.',
  },
  {
    id: 'ready_for_navigation',
    label: 'Ready for navigation',
    detail: 'Optimal transit route telemetry calculated & ready.',
  },
];

export const CoordinationStatus = ({
  facility,
  onExit,
  className = '',
}: CoordinationStatusProps) => {
  const navigate = useNavigate();
  // Step simulation: automatically advance through step 3 and 4 smoothly
  const [completedSteps, setCompletedSteps] = useState<number>(2);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setCompletedSteps(3);
    }, 700);

    const timer2 = setTimeout(() => {
      setCompletedSteps(4);
    }, 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const handleStartNavigation = () => {
    navigate(`/route/${facility.id}?emergency=true`);
  };

  const handleCallHospital = () => {
    window.location.href = `tel:${facility.phone.replace(/[^0-9+]/g, '')}`;
  };

  const handleCall911 = () => {
    window.location.href = 'tel:911';
  };

  return (
    <div className={`space-y-6 flex-1 flex flex-col justify-between ${className}`}>
      <div className="space-y-5">
        {/* Title Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Coordination Active
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
            Preparing your emergency coordination
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Destination locked to <strong className="text-slate-800">{facility.name}</strong>.
          </p>
        </div>

        {/* Selected Facility Destination Summary Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex items-start justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Emergency Destination
            </span>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
              {facility.name}
            </h3>
            <p className="text-xs text-slate-500 truncate">{facility.address}</p>
          </div>

          <div className="text-right shrink-0 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
            <span className="font-bold text-slate-900 text-xs sm:text-sm block">
              {facility.distance}
            </span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3 text-slate-400" />
              {facility.estimatedTime}
            </span>
          </div>
        </div>

        {/* 4-Step Visual Progress Stepper */}
        <div
          role="region"
          aria-label="Coordination status steps"
          className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block border-b border-slate-100 pb-2">
            Coordination Progress
          </span>

          <ol className="space-y-3 text-xs">
            {STEPS.map((step, idx) => {
              const stepNum = idx + 1;
              const isCompleted = stepNum <= completedSteps;
              const isCurrent = stepNum === completedSteps && completedSteps < 4;

              return (
                <li
                  key={step.id}
                  className="flex items-start gap-3"
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                        {stepNum}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span
                      className={`font-semibold block ${
                        isCompleted ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                      {step.detail}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Explicit Hospital Notification Notice */}
        <div className="p-3 bg-slate-100 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong>Notice:</strong> Hospital notification will be available when connected to ResQ services. In an immediate life-threatening emergency, call 911 directly.
          </p>
        </div>
      </div>

      {/* Primary Actions Area */}
      <div className="pt-4 sticky bottom-0 bg-slate-50/95 backdrop-blur-xs py-3 border-t border-slate-200/80 -mx-4 px-4 sm:mx-0 sm:px-0 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Button
            variant="primary"
            size="lg"
            icon={<Navigation className="w-4 h-4" />}
            onClick={handleStartNavigation}
            className="flex-1 font-bold"
            aria-label={`Start navigation to ${facility.name}`}
          >
            Start Navigation
          </Button>

          <Button
            variant="secondary"
            size="lg"
            icon={<Phone className="w-4 h-4" />}
            onClick={handleCallHospital}
            className="flex-1"
            aria-label={`Call ${facility.name}`}
          >
            Call Hospital
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 px-1">
          <button
            type="button"
            onClick={handleCall911}
            className="text-rose-700 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Direct 911 Emergency Dial</span>
          </button>

          <button
            type="button"
            onClick={onExit}
            className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>Exit Emergency Flow</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
