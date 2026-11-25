import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ChevronDown, ChevronUp, CircleAlert, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { LiveAmbulanceTracking } from '../LiveAmbulanceTracking';
import {
  hospitalKeys, useAcceptHospitalCoordinationNotification, useAcknowledgeHospitalCoordinationNotification, useHospitalCoordinationDetail,
  useHospitalCoordinationNotifications, useHospitalEmergencyStatusMutation, useHospitalProfile,
} from '../../hooks/useHospitalManagement';
import type { HospitalCoordinationNotification, HospitalEmergencyStatus } from '../../types/hospitalManagement';
import { createTrackingSocket, subscribeTrackingRoom, type TrackingEnvelope } from '../../services/trackingSocket';

const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export const HospitalCoordinationInbox = () => {
  const queryClient = useQueryClient();
  const profile = useHospitalProfile();
  const [state, setState] = useState<'UNREAD' | 'ALL'>('UNREAD');
  const [selectedEmergencyId, setSelectedEmergencyId] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<'CONNECTING' | 'CONNECTED' | 'RECONNECTING'>('CONNECTING');
  const notifications = useHospitalCoordinationNotifications({ state, page: 1, limit: 25 });
  const selectedDetail = useHospitalCoordinationDetail(selectedEmergencyId ?? '');
  const acknowledge = useAcknowledgeHospitalCoordinationNotification();
  const accept = useAcceptHospitalCoordinationNotification();
  const statusMutation = useHospitalEmergencyStatusMutation();

  useEffect(() => {
    const hospitalId = profile.data?.id;
    if (!hospitalId) return;
    let disposed = false;
    let socket: ReturnType<typeof createTrackingSocket> | undefined;
    const refreshHospitalState = () => {
      void queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
    };
    try {
      socket = createTrackingSocket();
      const currentSocket = socket;
      const subscribe = () => {
        setRealtime('CONNECTED');
        void subscribeTrackingRoom(currentSocket, { type: 'hospital-operations', id: hospitalId })
          .then(() => { if (!disposed) refreshHospitalState(); })
          .catch(() => { if (!disposed) setRealtime('RECONNECTING'); });
      };
      const onNotification = (envelope: TrackingEnvelope<{ hospitalId?: string }>) => {
        if (envelope?.data?.hospitalId && envelope.data.hospitalId !== hospitalId) return;
        refreshHospitalState();
      };
      currentSocket.on('connect', subscribe);
      currentSocket.on('disconnect', () => { if (!disposed) setRealtime('RECONNECTING'); });
      currentSocket.on('connect_error', (error) => {
        if (!disposed) setRealtime('RECONNECTING');
        if (error?.message === 'UNAUTHORIZED' || error?.message?.includes('UNAUTHORIZED')) {
          currentSocket.disconnect();
        }
      });
      currentSocket.on('hospital:coordination-notification', onNotification);
      currentSocket.on('hospital:coordination-notification-acknowledged', refreshHospitalState);
      currentSocket.on('hospital:incoming-patient', refreshHospitalState);
      currentSocket.on('tracking:status', refreshHospitalState);
      if (currentSocket.connected) subscribe();
      return () => {
        disposed = true;
        currentSocket.off('hospital:coordination-notification', onNotification);
        currentSocket.off('hospital:coordination-notification-acknowledged', refreshHospitalState);
        currentSocket.off('hospital:incoming-patient', refreshHospitalState);
        currentSocket.off('tracking:status', refreshHospitalState);
        currentSocket.disconnect();
      };
    } catch {
      return () => { disposed = true; socket?.disconnect(); };
    }
  }, [profile.data?.id, queryClient]);

  const items = notifications.data?.items ?? [];
  const detail = selectedDetail.data;
  const handleStatus = (emergencyId: string, next: HospitalEmergencyStatus) => {
    if (next === 'CANCELLED' && !window.confirm('Cancel this emergency response? You can only do this before the patient leaves.')) return;
    statusMutation.mutate({ id: emergencyId, status: next }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: hospitalKeys.coordinationDetail(emergencyId) });
        void queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
      },
    });
  };

  return (
    <section
      className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl"
      aria-label="Emergency alerts"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Bell className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-light text-zinc-100 tracking-tight">Emergency alerts</h2>
                <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 text-xs font-mono font-bold">
                  {notifications.data?.unreadCount ?? 0} unread
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Realtime Telemetry Status Badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border ${
            realtime === 'CONNECTED'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-xs'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
          }`}>
            {realtime === 'CONNECTED' ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live connection</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                <span>Trying to reconnect</span>
              </>
            )}
          </span>

          <button
            type="button"
            onClick={() => void notifications.refetch()}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
            <span>Refresh</span>
          </button>

          <select
            aria-label="Filter alerts"
            value={state}
            onChange={(event) => setState(event.target.value as 'UNREAD' | 'ALL')}
            className="rounded-xl border border-white/10 bg-zinc-900/80 text-zinc-300 px-3 py-1.5 text-xs outline-none focus:border-rose-500/40 cursor-pointer"
          >
            <option value="UNREAD">New alerts</option>
            <option value="ALL">All alerts</option>
          </select>
        </div>
      </header>

      {notifications.isError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
          <span>Could not load alerts. Try again.</span>
          <button
            type="button"
            onClick={() => void notifications.refetch()}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-500 transition"
          >
            Retry
          </button>
        </div>
      )}

      {notifications.isLoading ? (
        <p className="p-8 text-center text-xs font-mono text-zinc-500">Loading alerts…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.01] p-8 text-center space-y-2">
          <CircleAlert className="mx-auto h-6 w-6 text-zinc-500" />
          <p className="text-sm font-medium text-zinc-300">
            {state === 'UNREAD' ? 'No new alerts' : 'No alerts yet'}
          </p>
          <p className="text-xs text-zinc-500 font-light">
            New emergency alerts will show here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: HospitalCoordinationNotification) => {
            const expanded = selectedEmergencyId === item.emergencyId;
            const canAccept = item.type === 'EMERGENCY_RECEIVED';
            const actionError = accept.isError && accept.variables === item.id
              ? accept.error
              : acknowledge.isError && acknowledge.variables === item.id
                ? acknowledge.error
                : null;
            return (
              <article
                key={item.id}
                className={`rounded-xl border p-5 transition-all duration-300 ${
                  item.state === 'UNREAD'
                    ? 'border-rose-500/30 bg-rose-500/[0.04] shadow-lg shadow-rose-950/20'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left cursor-pointer"
                    onClick={() => setSelectedEmergencyId(expanded ? null : item.emergencyId)}
                    aria-expanded={expanded}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-100 bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded">
                        {item.requestCode}
                      </span>
                      <StatusBadge
                        variant={item.state === 'UNREAD' ? 'waitTime' : item.state === 'ACKNOWLEDGED' ? 'verified' : 'neutral'}
                        label={label(item.state)}
                      />
                      <span className="text-xs text-zinc-400 font-mono">{label(item.type)}</span>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-zinc-100">{item.title}</h3>
                    <p className="mt-2 text-[11px] font-mono text-zinc-400">
                      Type: <span className="text-zinc-200">{item.emergencyCategory}</span>
                      {item.etaMinutes !== undefined ? ` · Arrives in ${item.etaMinutes} min` : ''}
                      {item.tripStatus ? ` · Trip: ${label(item.tripStatus)}` : ''}
                    </p>
                    {(item.ambulanceRegistration || item.ambulanceVehicleNumber) && (
                      <p className="mt-1 text-xs font-mono text-zinc-400">
                        Ambulance: {item.ambulanceRegistration ?? 'Number not available'}
                        {item.ambulanceVehicleNumber ? ` · ${item.ambulanceVehicleNumber}` : ''}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] font-mono text-zinc-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.state === 'UNREAD' && (
                      <button
                        type="button"
                        disabled={acknowledge.isPending || accept.isPending}
                        onClick={() => canAccept ? accept.mutate(item.id) : acknowledge.mutate(item.id)}
                        aria-label={`${canAccept ? 'Accept' : 'Acknowledge'} ${item.title}`}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>
                          {(acknowledge.isPending && acknowledge.variables === item.id) || (accept.isPending && accept.variables === item.id)
                            ? 'Saving…'
                            : canAccept ? 'Accept' : 'Acknowledge'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedEmergencyId(expanded ? null : item.emergencyId)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{expanded ? 'Hide details' : 'View details'}</span>
                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {actionError && (
                  <p role="alert" className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    Could not {canAccept ? 'accept' : 'acknowledge'} this alert. {actionError.message || 'Try again.'}
                  </p>
                )}

                {expanded && (
                  <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                    {selectedDetail.isLoading ? (
                      <p className="text-xs font-mono text-zinc-500">Loading details…</p>
                    ) : selectedDetail.isError || !detail ? (
                      <div className="flex items-center justify-between gap-3 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                        <span>Could not load these details.</span>
                        <button
                          type="button"
                          onClick={() => void selectedDetail.refetch()}
                          className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 bg-white/[0.02] border border-white/5 p-4 rounded-xl text-xs">
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Emergency</p>
                            <p className="mt-1 font-semibold text-zinc-200">{detail.emergency.requestCode}</p>
                            <p className="mt-0.5 text-zinc-400 font-light">{detail.emergency.situationType}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Case status</p>
                            <p className="mt-1 font-semibold text-zinc-200">{label(detail.patient?.coordinationStatus ?? detail.emergency.status)}</p>
                            <p className="mt-0.5 text-zinc-400 font-mono">Case {detail.patient?.caseId ?? 'not linked'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Trip status</p>
                            <p className="mt-1 font-semibold text-zinc-200">{detail.trip ? label(detail.trip.status) : 'Awaiting assignment'}</p>
                            <p className="mt-0.5 text-zinc-400 font-light">
                              {detail.trip?.arrivedAtHospitalAt
                                ? `Arrived ${new Date(detail.trip.arrivedAtHospitalAt).toLocaleTimeString()}`
                                : detail.emergency.etaMinutes !== undefined
                                ? `ETA ${detail.emergency.etaMinutes} min`
                                : 'ETA unavailable'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Patient</p>
                            <p className="mt-1 font-semibold text-zinc-200">{detail.emergency.patientName || 'Details not available'}</p>
                            {detail.emergency.patientPhone ? (
                                <a
                                  href={`tel:${detail.emergency.patientPhone.replace(/[^0-9+]/g, '')}`}
                                  className="mt-0.5 inline-block text-rose-300 hover:text-rose-200"
                                >
                                  Call {detail.emergency.patientPhone}
                                </a>
                            ) : (
                                <p className="mt-0.5 text-zinc-500">Phone number not shared</p>
                            )}
                            {(detail.emergency.patientAge !== undefined || detail.emergency.patientGender) && (
                                <p className="mt-0.5 text-zinc-400">
                                  {[detail.emergency.patientAge !== undefined ? `${detail.emergency.patientAge} years` : null, detail.emergency.patientGender || null]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Ambulance</p>
                            <p className="mt-1 font-semibold text-zinc-200">{detail.ambulance ? detail.ambulance.registrationNumber : 'Not currently assigned'}</p>
                            <p className="mt-0.5 text-zinc-400 font-mono">{detail.ambulance ? `${detail.ambulance.vehicleNumber} · ${detail.ambulance.ambulanceType}` : 'No active vehicle'}</p>
                            {detail.trip?.driver?.name && <p className="mt-1 text-zinc-300">Driver: {detail.trip.driver.name}</p>}
                            {detail.trip?.driver?.phone && (
                                <a href={`tel:${detail.trip.driver.phone.replace(/[^0-9+]/g, '')}`} className="mt-0.5 inline-block text-rose-300 hover:text-rose-200">
                                  Call driver
                                </a>
                            )}
                          </div>
                        </div>

                        {detail.trip && (
                          <div className="rounded-xl overflow-hidden border border-white/10">
                            <LiveAmbulanceTracking emergencyRequestId={detail.emergency.id} subscribeHospitalOperations />
                          </div>
                        )}

                        {detail.allowedActions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-3">
                            <span className="mr-2 text-xs font-mono text-zinc-400">Actions:</span>
                            {detail.allowedActions.map((action) => (
                              <button
                                key={action}
                                type="button"
                                disabled={statusMutation.isPending}
                                onClick={() => handleStatus(detail.emergency.id, action)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                                  action === 'CANCELLED'
                                    ? 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30'
                                    : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/10'
                                }`}
                              >
                                {statusMutation.isPending && statusMutation.variables?.status === action ? 'Saving…' : label(action)}
                              </button>
                            ))}
                          </div>
                        )}

                        {statusMutation.isError && (
                          <p role="alert" className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                            Could not save this change. Refresh the details and try again.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

    </section>
  );
};
