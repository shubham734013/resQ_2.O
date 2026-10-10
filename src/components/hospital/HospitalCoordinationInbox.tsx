import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ChevronDown, ChevronUp, CircleAlert, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { LiveAmbulanceTracking } from '../LiveAmbulanceTracking';
import {
  hospitalKeys, useAcknowledgeHospitalCoordinationNotification, useHospitalCoordinationDetail,
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
      currentSocket.on('connect_error', () => { if (!disposed) setRealtime('RECONNECTING'); });
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
    if (next === 'CANCELLED' && !window.confirm('Cancel this emergency coordination? This action is only available before patient transport begins.')) return;
    statusMutation.mutate({ id: emergencyId, status: next }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: hospitalKeys.coordinationDetail(emergencyId) });
        void queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
      },
    });
  };

  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Hospital coordination inbox">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-slate-700" /><h2 className="text-base font-semibold text-slate-950">Hospital Coordination Inbox</h2><span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">{notifications.data?.unreadCount ?? 0} unread</span></div>
        <p className="mt-1 text-sm text-slate-500">Persisted emergency, ambulance assignment, transport and arrival alerts. Refresh and reconnect recover from the server inbox.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">{realtime === 'CONNECTED' ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-amber-600" />}{realtime === 'CONNECTED' ? 'Realtime connected' : 'Recovering through REST'}</span>
        <Button size="sm" variant="secondary" onClick={() => void notifications.refetch()} icon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh inbox</Button>
        <select aria-label="Notification filter" value={state} onChange={(event) => setState(event.target.value as 'UNREAD' | 'ALL')} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs">
          <option value="UNREAD">Unread</option><option value="ALL">All alerts</option>
        </select>
      </div>
    </header>

    {notifications.isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span>Saved coordination alerts could not be loaded. No alert is considered delivered from a socket event alone.</span><Button size="sm" variant="secondary" onClick={() => void notifications.refetch()}>Retry</Button></div>}
    {notifications.isLoading ? <p className="p-4 text-sm text-slate-500">Loading saved alerts…</p> : items.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center"><CircleAlert className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-2 text-sm font-medium text-slate-700">{state === 'UNREAD' ? 'No unread coordination alerts' : 'No coordination alerts recorded'}</p><p className="mt-1 text-xs text-slate-500">The server reconciles persisted emergency and trip state when this inbox loads.</p></div> : <div className="space-y-2">
      {items.map((item: HospitalCoordinationNotification) => {
        const expanded = selectedEmergencyId === item.emergencyId;
        return <article key={item.id} className={`rounded-lg border ${item.state === 'UNREAD' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'} p-3 sm:p-4`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedEmergencyId(expanded ? null : item.emergencyId)} aria-expanded={expanded}>
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-slate-800">{item.requestCode}</span><StatusBadge variant={item.state === 'UNREAD' ? 'waitTime' : item.state === 'ACKNOWLEDGED' ? 'verified' : 'neutral'} label={label(item.state)} /><span className="text-xs text-slate-500">{label(item.type)}</span></div>
              <h3 className="mt-2 text-sm font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.message}</p>
              <p className="mt-2 text-xs text-slate-500">Category: {item.emergencyCategory}{item.etaMinutes !== undefined ? ` · ETA ${item.etaMinutes} min` : ''}{item.tripStatus ? ` · Trip: ${label(item.tripStatus)}` : ''}</p>
              {(item.ambulanceRegistration || item.ambulanceVehicleNumber) && <p className="mt-1 text-xs font-medium text-slate-700">Ambulance: {item.ambulanceRegistration ?? 'Registration unavailable'}{item.ambulanceVehicleNumber ? ` · ${item.ambulanceVehicleNumber}` : ''}</p>}
              <p className="mt-1 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              {item.state === 'UNREAD' && <Button size="sm" variant="primary" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(item.id)} icon={<Check className="h-3.5 w-3.5" />}>{acknowledge.isPending && acknowledge.variables === item.id ? 'Saving…' : 'Acknowledge'}</Button>}
              <Button size="sm" variant="secondary" onClick={() => setSelectedEmergencyId(expanded ? null : item.emergencyId)} icon={expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}>{expanded ? 'Hide case' : 'View case'}</Button>
            </div>
          </div>
          {expanded && <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            {selectedDetail.isLoading ? <p className="text-sm text-slate-500">Loading current case state…</p> : selectedDetail.isError || !detail ? <div className="flex items-center justify-between gap-3 text-sm text-rose-800"><span>Current case details could not be loaded.</span><Button size="sm" variant="secondary" onClick={() => void selectedDetail.refetch()}>Retry</Button></div> : <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs text-slate-500">Emergency</p><p className="mt-1 text-sm font-semibold">{detail.emergency.requestCode} · {detail.emergency.category}</p><p className="mt-1 text-xs text-slate-500">{detail.emergency.situationType}</p></div>
                <div><p className="text-xs text-slate-500">Coordination state</p><p className="mt-1 text-sm font-semibold">{label(detail.patient?.coordinationStatus ?? detail.emergency.status)}</p><p className="mt-1 text-xs text-slate-500">Case {detail.patient?.caseId ?? 'not linked'}</p></div>
                <div><p className="text-xs text-slate-500">Trip status</p><p className="mt-1 text-sm font-semibold">{detail.trip ? label(detail.trip.status) : 'Awaiting assignment'}</p><p className="mt-1 text-xs text-slate-500">{detail.trip?.arrivedAtHospitalAt ? `Arrived ${new Date(detail.trip.arrivedAtHospitalAt).toLocaleTimeString()}` : detail.emergency.etaMinutes !== undefined ? `Estimated arrival ${detail.emergency.etaMinutes} min` : 'ETA unavailable'}</p></div>
                <div><p className="text-xs text-slate-500">Assigned ambulance</p><p className="mt-1 text-sm font-semibold">{detail.ambulance ? detail.ambulance.registrationNumber : 'Not currently assigned'}</p><p className="mt-1 text-xs text-slate-500">{detail.ambulance ? `${detail.ambulance.vehicleNumber} · ${detail.ambulance.ambulanceType}` : 'No active vehicle details'}</p>{detail.ambulance?.location && <p className={`mt-1 text-xs font-medium ${detail.ambulance.location.coordinatesAreLive ? 'text-emerald-700' : 'text-amber-700'}`}>GPS {detail.ambulance.location.freshness.toLowerCase()} · {detail.ambulance.location.updatedAt ? new Date(detail.ambulance.location.updatedAt).toLocaleTimeString() : 'timestamp unavailable'}</p>}</div>
              </div>
              {detail.trip && <LiveAmbulanceTracking emergencyRequestId={detail.emergency.id} subscribeHospitalOperations />}
              {detail.allowedActions.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"><span className="mr-1 text-xs font-semibold text-slate-600">Permitted hospital actions</span>{detail.allowedActions.map((action) => <Button key={action} size="sm" variant={action === 'CANCELLED' ? 'secondary' : 'primary'} disabled={statusMutation.isPending} onClick={() => handleStatus(detail.emergency.id, action)}>{statusMutation.isPending && statusMutation.variables?.status === action ? 'Saving…' : label(action)}</Button>)}</div>}
              {statusMutation.isError && <p role="alert" className="text-xs text-rose-700">The backend rejected or could not save that status transition. Refresh case details before trying again.</p>}
            </>}
          </div>}
        </article>;
      })}
    </div>}
    <p className="text-[11px] text-slate-400">Notification acknowledgement is hospital-scoped. The inbox stores minimal operational information and never includes patient names, phone numbers or unrestricted medical records.</p>
  </section>;
};
