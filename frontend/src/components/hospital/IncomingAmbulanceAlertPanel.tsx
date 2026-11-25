import { useState } from 'react';
import {
  AlertCircle,
  Ambulance,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  User,
  Phone,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import type { HospitalEmergency, HospitalEmergencyStatus } from '../../types/hospitalManagement';
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400">
              <Ambulance className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-100">Live emergency requests</h3>
              <p className="mt-0.5 text-xs text-zinc-500">No active requests on this page.</p>
            </div>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Live emergency requests"
      className="rounded-2xl border border-rose-500/40 bg-rose-500/[0.04] backdrop-blur-xl p-5 sm:p-6 shadow-2xl space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/20 pb-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-light text-rose-200 tracking-tight">
                Live emergency requests
              </h2>
              <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-mono font-bold text-white shadow-xs">
                {incomingItems.length}
              </span>
            </div>
            <p className="text-xs text-rose-300/80 font-light mt-0.5">
              Active cases are shown here. Use the live totals above to see how many patients are travelling by ambulance.
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-medium text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
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
              className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 shadow-xl space-y-3.5 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-zinc-100 bg-white/[0.06] border border-white/10 px-2.5 py-1 rounded-md">
                        {e.requestCode}
                      </span>
                      <h4 className="font-medium text-zinc-100 text-sm sm:text-base">
                        {e.situationType}
                      </h4>
                      <StatusBadge
                        variant={e.status === 'RECEIVED' ? 'emergency' : 'waitTime'}
                        label={e.status.replace(/_/g, ' ')}
                      />
                      {e.severity && (
                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                          e.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' :
                          e.severity === 'URGENT' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        }`}>
                          {e.severity === 'CRITICAL' ? 'Critical' : e.severity === 'URGENT' ? 'Urgent' : 'Normal'}
                        </span>
                      )}
                      {e.pickupOtpVerified && (
                        <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Patient picked up · code checked</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-4 text-xs text-zinc-400 flex-wrap font-light">
                      <span className="flex items-center gap-1 text-zinc-200 font-medium">
                        <User className="h-3.5 w-3.5 text-zinc-400" />
                        <span>
                          {e.patientName || 'Patient details not available'}
                          {(e.patientAge !== undefined || e.patientGender) && (
                            <span className="text-zinc-400">
                              {' '}({[
                                e.patientAge !== undefined ? `${e.patientAge} yrs` : null,
                                e.patientGender || null,
                              ].filter(Boolean).join(', ')})
                            </span>
                          )}
                        </span>
                      </span>
                      {e.patientPhone && (
                        <a
                          href={`tel:${e.patientPhone.replace(/[^0-9+]/g, '')}`}
                          onClick={(event) => event.stopPropagation()}
                          className="flex items-center gap-1 text-rose-300 hover:text-rose-200"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>{e.patientPhone}</span>
                        </a>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{e.location ?? 'Pickup location sent'}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono text-zinc-400">
                        <Clock className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Reported at {new Date(e.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <div className="text-right bg-zinc-900/80 border border-white/10 rounded-xl px-3.5 py-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                      ETA
                    </span>
                    <span className="text-sm font-mono font-bold text-zinc-100 flex items-center gap-1 justify-end">
                      <Clock className="h-3.5 w-3.5 text-rose-400" />
                      {e.etaMinutes !== undefined ? `${e.etaMinutes} min` : 'Not known'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {e.status === 'RECEIVED' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onUpdateStatus(e.id, 'REVIEWING')}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-md shadow-rose-950/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{isBusy ? 'Updating…' : 'Start review'}</span>
                      </button>
                    )}
                    {e.status === 'REVIEWING' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onUpdateStatus(e.id, 'PREPARING')}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>{isBusy ? 'Updating…' : 'Prepare a room'}</span>
                      </button>
                    )}
                    {e.status === 'PREPARING' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onUpdateStatus(e.id, 'AMBULANCE_COORDINATION')}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/10 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Ambulance className="h-3.5 w-3.5" />
                        <span>{isBusy ? 'Updating…' : 'Arrange transport'}</span>
                      </button>
                    )}
                    {e.status === 'AMBULANCE_COORDINATION' && (
                      <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-mono">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Room is ready</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : e.id)}
                      className="text-xs font-medium text-zinc-300 hover:text-white px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition cursor-pointer"
                    >
                      {isExpanded ? 'Hide details' : 'Show details'}
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="pt-3 border-t border-white/[0.08] text-xs text-zinc-300 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                  <div>
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase tracking-wider">Patient contact</span>
                    {e.patientName && <span className="font-medium text-zinc-200 block">{e.patientName}</span>}
                    {e.patientPhone ? (
                      <a href={`tel:${e.patientPhone.replace(/[^0-9+]/g, '')}`} className="mt-0.5 inline-flex items-center gap-1 text-rose-300 hover:text-rose-200">
                        <Phone className="h-2.5 w-2.5" />
                        <span>{e.patientPhone}</span>
                      </a>
                    ) : (
                      <span className="mt-0.5 block text-zinc-500">Phone number not shared</span>
                    )}
                  </div>
                  <div>
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase tracking-wider">Ambulance</span>
                    <span className="font-medium text-zinc-200 block">
                      {e.ambulanceRegistration ?? (e.ambulanceId ? 'Assigned, details not available' : 'Not assigned')}
                      {e.ambulanceType ? ` (${e.ambulanceType})` : ''}
                    </span>
                    {e.ambulanceVehicleNumber && <span className="text-zinc-400 block">{e.ambulanceVehicleNumber}</span>}
                    {typeof e.ambulanceLatitude === 'number' && typeof e.ambulanceLongitude === 'number' && (
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 mt-0.5">
                        <Radio className="h-2.5 w-2.5 animate-pulse" />
                        Location: {e.ambulanceLatitude.toFixed(4)}, {e.ambulanceLongitude.toFixed(4)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase tracking-wider">Driver & Contact</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-medium text-zinc-200 font-mono">
                          {e.driverName ?? 'Not assigned'}
                      </span>
                      {e.driverPhone && (
                        <a
                          href={`tel:${e.driverPhone.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 px-2 py-0.5 rounded-md border border-rose-500/30 transition"
                        >
                          <Phone className="h-2.5 w-2.5" />
                          <span>Call Driver</span>
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block font-mono text-[10px] uppercase tracking-wider">Pickup status</span>
                    <span className="font-medium text-zinc-200 font-mono block">
                      {e.pickupOtpVerified
                        ? (e.pickupOverrideReason ? `Pickup marked without code: ${e.pickupOverrideReason}` : 'Patient picked up (code checked)')
                        : (e.tripStatus ? `Ambulance: ${e.tripStatus.replace(/_/g, ' ')}` : 'Waiting for ambulance')}
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
