import {
  Clock,
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import type { Facility } from '../../types/facility';

export interface FacilityStatusProps {
  facility: Facility;
  className?: string;
}

export const FacilityStatus = ({
  facility,
  className = '',
}: FacilityStatusProps) => {
  const isAvailable = facility.isAvailable ?? facility.isOpen;
  const isStale = facility.isStale ?? false;

  return (
    <div className={`space-y-4 font-sans ${className}`}>
      {/* 1. Critical Availability Banner if Unavailable */}
      {!isAvailable && (
        <div
          role="alert"
          className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-300 text-xs backdrop-blur-md shadow-lg"
        >
          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-semibold block text-zinc-100">Facility Currently Unavailable</span>
            <p className="text-zinc-400 leading-relaxed">
              This facility is currently not accepting emergency intake or walk-ins ({facility.openStatus}). Please select an alternative facility for immediate care.
            </p>
          </div>
        </div>
      )}

      {/* 2. Stale Information Notice if data is outdated */}
      {isStale && (
        <div
          role="status"
          className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-amber-300 text-xs backdrop-blur-md"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span>
            Operating capacity was last verified <strong className="font-mono text-zinc-200">{facility.lastUpdated}</strong>. Verify directly before navigating.
          </span>
        </div>
      )}

      {/* 3. Availability & Operational Status Card */}
      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
              Operating Status
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Telemetry Updated {facility.lastUpdated}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Intake Availability */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            {isAvailable ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div>
              <span className="font-semibold text-zinc-100 block">
                {facility.operatingStatus ?? (isAvailable ? 'Live 24/7 Operational' : 'Closed')}
              </span>
              <span className="text-zinc-400 text-[11px] mt-0.5 block">{facility.openStatus}</span>
            </div>
          </div>

          {/* Triage / Wait Time */}
          {facility.triageWaitTime && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <Clock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-semibold text-zinc-100 block">Estimated Triage</span>
                <span className="text-zinc-400 font-mono text-[11px] mt-0.5 block">{facility.triageWaitTime}</span>
              </div>
            </div>
          )}

          {/* Ambulance Availability */}
          {facility.ambulanceAvailability && (
            <div className="flex items-start gap-3 col-span-1 sm:col-span-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <Ambulance className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-medium text-zinc-300">Ambulance Coordination:</span>
                <span
                  className={`font-mono font-semibold px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1.5 ${
                    facility.ambulanceAvailability === 'Available'
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : 'bg-white/[0.04] text-zinc-400 border border-white/10'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      facility.ambulanceAvailability === 'Available' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                    }`}
                  />
                  {facility.ambulanceAvailability}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
