import { useState } from 'react';
import {
  AlertCircle,
  Ambulance,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import type { HospitalEmergency, HospitalEmergencyStatus } from '../../types/hospitalManagement';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';

export interface IncomingAmbulanceAlertPanelProps {
  emergencies: HospitalEmergency[];
  onUpdateStatus: (id: string, status: HospitalEmergencyStatus) => void;
  isUpdating?: boolean;
  updatingId?: string;
  onRefresh?: () => void;
}

export const IncomingAmbulanceAlertPanel = ({
  emergencies,
  onUpdateStatus,
  isUpdating = false,
  updatingId,
  onRefresh,
}: IncomingAmbulanceAlertPanelProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const incomingItems = emergencies.filter((e) =>
    ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(e.status)
  );

  if (incomingItems.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Ambulance className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Incoming Dispatch Telemetry</h3>
              <p className="text-xs text-slate-500">
                No active incoming ambulances or critical arrivals. Hospital reception queue is clear.
              </p>
            </div>
          </div>
          {onRefresh && (
            <Button size="sm" variant="outline" onClick={onRefresh} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Incoming ambulance alerts"
      className="rounded-2xl border-2 border-rose-500/80 bg-rose-50/40 p-4 sm:p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-200/80 pb-3.5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-rose-950 uppercase tracking-wide">
                Active Incoming Dispatch Alerts
              </h2>
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                {incomingItems.length}
              </span>
            </div>
            <p className="text-xs text-rose-800/90 mt-0.5">
              Live patient arrivals and coordinated ambulance transports heading to your facility.
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-semibold text-rose-800 hover:text-rose-950 bg-rose-100/80 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Update Telemetry</span>
          </button>
        )}
      </div>

      <div className="space-y-3">
        {incomingItems.map((e) => {
          const isBusy = isUpdating && updatingId === e.id;
          const isExpanded = expandedId === e.id;

          return (
            <div
              key={e.id}
              className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm space-y-3 transition"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {e.requestCode}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        {e.situationType}
                      </h4>
                      <StatusBadge
                        variant={e.status === 'RECEIVED' ? 'emergency' : 'waitTime'}
                        label={e.status.replace(/_/g, ' ')}
                      />
                    </div>

                    <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{e.location ?? 'Pickup coordinates transmitted'}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Reported {new Date(e.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <div className="text-right bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Arrival ETA
                    </span>
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1 justify-end">
                      <Clock className="h-3.5 w-3.5 text-rose-600" />
                      {e.etaMinutes !== undefined ? `${e.etaMinutes} min` : 'En Route'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {e.status === 'RECEIVED' && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        disabled={isBusy}
                        onClick={() => onUpdateStatus(e.id, 'REVIEWING')}
                      >
                        {isBusy ? 'Updating...' : 'Acknowledge'}
                      </Button>
                    )}
                    {e.status === 'REVIEWING' && (
                      <Button
                        size="sm"
                        variant="emergency"
                        icon={<AlertCircle className="h-4 w-4" />}
                        disabled={isBusy}
                        onClick={() => onUpdateStatus(e.id, 'PREPARING')}
                      >
                        {isBusy ? 'Updating...' : 'Prepare Trauma Bay'}
                      </Button>
                    )}
                    {e.status === 'PREPARING' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Ambulance className="h-4 w-4" />}
                        disabled={isBusy}
                        onClick={() => onUpdateStatus(e.id, 'AMBULANCE_COORDINATION')}
                      >
                        {isBusy ? 'Updating...' : 'Coordinating Transport'}
                      </Button>
                    )}
                    {e.status === 'AMBULANCE_COORDINATION' && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Bay Prepared & On Standby</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : e.id)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded border border-slate-200 bg-white"
                    >
                      {isExpanded ? 'Less' : 'Details'}
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 grid gap-2 sm:grid-cols-3 bg-slate-50/50 p-3 rounded-lg">
                  <div>
                    <span className="text-slate-400 block font-medium">Assigned Ambulance</span>
                    <span className="font-semibold text-slate-800">
                      {e.ambulanceId ?? 'Auto-dispatching via ambulance provider'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Driver Reference</span>
                    <span className="font-semibold text-slate-800">
                      {e.driverId ?? 'Pending driver acceptance'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Patient Reference</span>
                    <span className="font-semibold text-slate-800">
                      {e.patientId ?? 'Anonymous / Walk-in / Emergency intake'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
