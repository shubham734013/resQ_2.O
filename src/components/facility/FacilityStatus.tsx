import {
  Clock,
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  XCircle,
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
    <div className={`space-y-3 ${className}`}>
      {/* 1. Critical Availability Banner if Unavailable */}
      {!isAvailable && (
        <div
          role="alert"
          className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl flex items-start gap-2.5 text-amber-950 text-xs"
        >
          <XCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-semibold block">Facility Currently Unavailable</span>
            <p className="text-amber-800 leading-relaxed">
              This facility is currently not accepting emergency intake or walk-ins ({facility.openStatus}). Please choose an alternative facility for immediate care.
            </p>
          </div>
        </div>
      )}

      {/* 2. Stale Information Notice if data is outdated */}
      {isStale && (
        <div
          role="status"
          className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 text-slate-700 text-xs"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
          <span>
            Operating capacity was last verified <strong>{facility.lastUpdated}</strong>. Verify directly with the facility before navigating.
          </span>
        </div>
      )}

      {/* 3. Availability & Operational Status Card */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Operating Status
          </span>
          <span className="text-[11px] text-slate-400">
            Updated {facility.lastUpdated}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Intake Availability */}
          <div className="flex items-start gap-2.5">
            {isAvailable ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div>
              <span className="font-semibold text-slate-900 block">
                {facility.operatingStatus ?? (isAvailable ? 'Operational' : 'Closed')}
              </span>
              <span className="text-slate-500 text-[11px]">{facility.openStatus}</span>
            </div>
          </div>

          {/* Triage / Wait Time */}
          {facility.triageWaitTime && (
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-semibold text-slate-900 block">Estimated Triage</span>
                <span className="text-slate-500 text-[11px]">{facility.triageWaitTime}</span>
              </div>
            </div>
          )}

          {/* Ambulance Availability */}
          {facility.ambulanceAvailability && (
            <div className="flex items-start gap-2.5 col-span-1 sm:col-span-2 pt-1 border-t border-slate-50">
              <Ambulance className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">Ambulance Coordination:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                    facility.ambulanceAvailability === 'Available'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : facility.ambulanceAvailability === 'On Request'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
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
