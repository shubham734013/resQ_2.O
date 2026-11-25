import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Navigation, Radio, RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './common/Button';
import { MapView } from './map/MapView';
import { createTrackingSocket, subscribeTrackingRoom, type TrackingEnvelope } from '../services/trackingSocket';
import { trackingApi, trackingRouteOption, type TrackingSnapshot } from '../services/trackingApi';
import type { MapMarker, RouteOptionItem } from '../types/route';

interface LiveAmbulanceTrackingProps {
  emergencyRequestId: string;
  subscribeHospitalOperations?: boolean;
}
interface LocationEvent {
  emergencyRequestId: string; tripId: string; tripStatus: string; ambulanceId: string;
  latitude: number; longitude: number; accuracyMeters?: number; locationUpdatedAt: string;
  sourceTimestamp?: string; freshness: 'FRESH' | 'STALE'; coordinatesAreLive: boolean;
}
const statusLabels: Record<string, string> = {
  ASSIGNED: 'Waiting for driver', ACCEPTED: 'Driver accepted · going to pickup', TO_PICKUP: 'Going to pickup',
  AT_PICKUP: 'At pickup place', PATIENT_ONBOARD: 'Patient picked up',
  TO_HOSPITAL: 'Going to hospital', AT_HOSPITAL: 'At hospital',
  COMPLETED: 'Trip done', CANCELLED: 'Trip canceled',
};
const dispatchStatusLabels: Record<string, string> = {
  SEARCHING: 'Looking for an ambulance',
  OFFERED: 'Request sent to a driver',
  ACCEPTED: 'A driver accepted the request',
  EXHAUSTED: 'No nearby ambulance is free',
  ESCALATED: 'A dispatcher is checking the request',
  CANCELLED: 'Request canceled',
};
const labelStatus = (status?: string) => statusLabels[status ?? ''] ?? status ?? 'Waiting for a driver';
const formatAge = (ageMs: number | null | undefined) => {
  if (typeof ageMs !== 'number') return 'Update time unknown';
  if (ageMs < 1000) return 'Updated just now';
  return `Updated ${Math.floor(ageMs / 1000)} seconds ago`;
};

export const LiveAmbulanceTracking = ({ emergencyRequestId, subscribeHospitalOperations = false }: LiveAmbulanceTrackingProps) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['tracking', 'emergency', emergencyRequestId] as const, [emergencyRequestId]);
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const snapshotQuery = useQuery({
    queryKey,
    queryFn: () => trackingApi.getEmergency(emergencyRequestId),
    enabled: Boolean(emergencyRequestId && isAuthenticated),
    staleTime: 0,
    refetchInterval: (query) => query.state.data?.trackingActive ? 15000 : 8000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const snapshot = snapshotQuery.data;

  useEffect(() => {
    if (!emergencyRequestId || !isAuthenticated || snapshotQuery.isError) return;
    const socket = createTrackingSocket();
    let disposed = false;
    const refresh = () => { void queryClient.invalidateQueries({ queryKey }); };
    socket.on('connect', () => {
      setConnected(true);
      setSocketError(null);
      void subscribeTrackingRoom(socket, { type: 'emergency', id: emergencyRequestId })
        .then(refresh)
        .catch(() => { if (!disposed) setSocketError('Live updates are not available.'); });
      if (subscribeHospitalOperations && snapshot?.hospital.id) {
        void subscribeTrackingRoom(socket, { type: 'hospital-operations', id: snapshot.hospital.id })
          .catch(() => { if (!disposed) setSocketError('Hospital updates are not available.'); });
      }
      refresh();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (error) => {
      setConnected(false);
      if (error?.message === 'UNAUTHORIZED' || error?.message?.includes('UNAUTHORIZED')) {
        setSocketError('Your sign-in ended. Sign in again to see live updates.');
        socket.disconnect();
      } else {
        setSocketError('Live updates stopped. Trying to reconnect.');
      }
    });
    const onLocation = (envelope: TrackingEnvelope<LocationEvent>) => {
      const event = envelope?.data;
      if (!event || event.emergencyRequestId !== emergencyRequestId) return;
      queryClient.setQueryData<TrackingSnapshot>(queryKey, (current) => {
        if (!current?.trip || current.trip.id !== event.tripId || !current.trackingActive || ['COMPLETED', 'CANCELLED'].includes(event.tripStatus)) return current;
        const incomingTime = Date.parse(event.locationUpdatedAt);
        const currentTime = current.location?.updatedAt ? Date.parse(current.location.updatedAt) : 0;
        if (!Number.isFinite(incomingTime) || incomingTime <= currentTime) return current;
        return {
          ...current,
          location: {
            latitude: event.latitude, longitude: event.longitude,
            accuracyMeters: event.accuracyMeters ?? null, updatedAt: event.locationUpdatedAt,
            sourceTimestamp: event.sourceTimestamp ?? null, ageMs: 0,
            freshness: event.freshness, coordinatesAreLive: event.coordinatesAreLive,
          },
          serverTime: envelope.timestamp,
        };
      });
    };
    const onState = () => refresh();
    socket.on('tracking:location', onLocation);
    socket.on('ambulance:locationUpdated', onLocation);
    socket.on('tracking:status', onState);
    socket.on('dispatch:accepted', onState);
    socket.on('dispatch:declined', onState);
    socket.on('hospital:incoming-patient', onState);
    return () => {
      disposed = true;
      socket.emit('tracking:unsubscribe', { type: 'emergency', id: emergencyRequestId });
      if (snapshot?.hospital.id && subscribeHospitalOperations) socket.emit('tracking:unsubscribe', { type: 'hospital-operations', id: snapshot.hospital.id });
      socket.disconnect();
      socket.removeAllListeners();
    };
  }, [emergencyRequestId, isAuthenticated, snapshotQuery.isError, queryClient, queryKey, subscribeHospitalOperations, snapshot?.hospital.id]);
  const routePhase = snapshot?.routeTarget ?? 'PICKUP';
  const location = snapshot?.location;
  const roundedLat = typeof location?.latitude === 'number' ? location.latitude.toFixed(3) : 'none';
  const roundedLng = typeof location?.longitude === 'number' ? location.longitude.toFixed(3) : 'none';
  const routeEnabled = Boolean(snapshot?.trip && snapshot.trackingActive && location?.coordinatesAreLive && !['AT_HOSPITAL', 'COMPLETED', 'CANCELLED'].includes(snapshot.trip.status));
  const routeQuery = useQuery({
    queryKey: ['tracking-route', snapshot?.trip?.id, routePhase, roundedLat, roundedLng],
    queryFn: () => trackingApi.getRoute(snapshot!.trip!.id),
    enabled: routeEnabled,
    staleTime: 18000,
    refetchInterval: routeEnabled ? 20000 : false,
    retry: 1,
  });
  const activeRoute: RouteOptionItem | null = useMemo(() => {
    const route = routeQuery.data?.routes[0];
    return route && !routeQuery.isError && snapshot?.trip?.status !== 'AT_HOSPITAL' ? trackingRouteOption(route) : null;
  }, [routeQuery.data, routeQuery.isError, snapshot?.trip?.status]);

  const markers: MapMarker[] = useMemo(() => {
    if (!snapshot) return [];
    const result: MapMarker[] = [];
    if (typeof snapshot.location?.latitude === 'number' && typeof snapshot.location.longitude === 'number' && snapshot.ambulance) {
      result.push({ id: 'ambulance', latitude: snapshot.location.latitude, longitude: snapshot.location.longitude, title: 'Ambulance', subtitle: snapshot.ambulance.vehicleNumber });
    }
    if (typeof snapshot.pickup.latitude === 'number' && typeof snapshot.pickup.longitude === 'number') {
      result.push({ id: 'pickup', latitude: snapshot.pickup.latitude, longitude: snapshot.pickup.longitude, title: 'Pickup', subtitle: snapshot.pickup.label, isEmergency: true });
    }
    if (typeof snapshot.hospital.latitude === 'number' && typeof snapshot.hospital.longitude === 'number') {
      result.push({ id: 'hospital', latitude: snapshot.hospital.latitude, longitude: snapshot.hospital.longitude, title: 'Hospital', subtitle: snapshot.hospital.name });
    }
    return result;
  }, [snapshot]);
  const center = typeof location?.latitude === 'number' && typeof location.longitude === 'number'
    ? { latitude: location.latitude, longitude: location.longitude }
    : typeof snapshot?.pickup.latitude === 'number' && typeof snapshot.pickup.longitude === 'number'
      ? { latitude: snapshot.pickup.latitude, longitude: snapshot.pickup.longitude }
      : undefined;
  const target = routePhase === 'HOSPITAL' ? snapshot?.hospital : snapshot?.pickup;
  const destination = target && typeof target.latitude === 'number' && typeof target.longitude === 'number'
    ? { latitude: target.latitude, longitude: target.longitude, name: routePhase === 'HOSPITAL' ? snapshot?.hospital.name ?? 'Hospital' : 'Patient pickup', address: routePhase === 'HOSPITAL' ? snapshot?.hospital.address : snapshot?.pickup.label }
    : undefined;

  if (snapshotQuery.isLoading) return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading ambulance status…</section>;
  if (snapshotQuery.isError || !snapshot) return <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">We could not load tracking details. We are not guessing where the ambulance is.</p><Button size="sm" variant="secondary" onClick={() => void snapshotQuery.refetch()} icon={<RefreshCw className="h-4 w-4" />}>Try again</Button></section>;

  return (
    <section className="resq-card rounded-2xl p-4 sm:p-5 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Track ambulance</p>
          </div>
          <h3 className="mt-1 text-lg font-bold text-slate-950 tracking-tight">{snapshot.emergency.requestCode}</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 font-medium">
            {snapshot.trip?.status === 'ASSIGNED'
              ? 'Looking for a driver'
              : snapshot.trip && snapshot.trackingActive
                ? labelStatus(snapshot.trip.status)
                : snapshot.trip && ['COMPLETED', 'CANCELLED'].includes(snapshot.trip.status)
                  ? labelStatus(snapshot.trip.status)
                  : snapshot.dispatch
                    ? dispatchStatusLabels[snapshot.dispatch.status] ?? snapshot.dispatch.status.toLowerCase().replaceAll('_', ' ')
                    : 'Waiting for an ambulance'}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            connected
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {connected ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-amber-600" />}
          {connected ? 'Live updates on' : 'Trying to reconnect'}
        </span>
      </header>

      {snapshot.dispatch?.status === 'EXHAUSTED' && !snapshot.trip && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-950 space-y-3">
          <div className="flex items-start gap-2.5">
            <Radio className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="font-bold text-sm text-rose-900">No ambulance is free right now</p>
              <p className="mt-1 leading-relaxed text-rose-800">
                All nearby ambulances are helping with other calls.
                Do not wait. Call 112 now or find a safe way to reach the nearest hospital:
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href="tel:108"
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-800 transition"
            >
              📞 Call 108 (ambulance)
            </a>
            <a
              href="tel:112"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
            >
              📞 Call 112 (emergency help)
            </a>
            {snapshot.hospital?.phone && (
              <a
                href={`tel:${snapshot.hospital.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-800 transition"
              >
                📞 Call {snapshot.hospital.name}
              </a>
            )}
          </div>
        </div>
      )}

      {(!snapshot.trip || snapshot.trip.status === 'ASSIGNED') && snapshot.dispatch?.status !== 'EXHAUSTED' && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-xs text-sky-950 flex items-start gap-2.5">
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 animate-pulse" />
          <p className="leading-relaxed">
            <strong>Looking for a driver:</strong> The driver's name, ambulance number, and location will show after a driver accepts.
          </p>
        </div>
      )}

      {snapshot.trip && snapshot.trackingActive && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Ambulance</span>
            <p className="font-bold text-slate-900 text-sm sm:text-base">{snapshot.ambulance?.vehicleNumber ?? 'Ambulance assigned'}</p>
            <p className="text-xs text-slate-600 font-medium">
              {snapshot.ambulance?.ambulanceType ?? 'Type unknown'} · {snapshot.ambulance?.driverName ?? 'Driver assigned'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ambulance location</span>
              {location?.coordinatesAreLive && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </div>
            <p className={`font-bold text-sm sm:text-base ${location?.coordinatesAreLive ? 'text-emerald-700' : 'text-amber-800'}`}>
              {location?.coordinatesAreLive ? 'Live location' : location ? 'Last location · May be old' : 'Waiting for location'}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              {formatAge(location?.ageMs)}
              {location?.accuracyMeters ? ` · Location may be off by about ${Math.round(location.accuracyMeters)} m` : ''}
            </p>
          </div>
        </div>
      )}

      {snapshot.trip && !snapshot.trackingActive && ['COMPLETED', 'CANCELLED'].includes(snapshot.trip.status) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{labelStatus(snapshot.trip.status)}. Live location tracking has ended.</span>
        </div>
      )}

      {snapshot.trip && snapshot.trackingActive && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50 border border-teal-200/70 text-teal-900 text-xs font-bold">
              <MapPin className="h-3.5 w-3.5 text-teal-700" />
              <span>{routePhase === 'HOSPITAL' ? 'Ambulance → Hospital' : 'Ambulance → Pickup place'}</span>
            </div>
            {routeQuery.isFetching && <span className="text-xs text-slate-500 font-medium">Updating route…</span>}
          </div>

          {routeQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <span>We cannot show the route, or the location may be old. The map still shows known places. The route does not prove that the ambulance arrived.</span>
              <Button size="sm" variant="secondary" onClick={() => void routeQuery.refetch()}>Try again</Button>
            </div>
          )}

          {routeQuery.data && activeRoute && (
            <div className="px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/80 text-xs text-slate-700 flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <span className="font-semibold">{activeRoute.distance}</span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-teal-800">{activeRoute.duration}</span>
              <span className="text-slate-400">•</span>
              <span className="text-[11px] text-slate-500">Route updated {new Date(routeQuery.data.fetchedAt).toLocaleTimeString()}</span>
            </div>
          )}

          <div className="h-[300px] min-h-[280px] overflow-hidden rounded-xl border border-slate-200 sm:h-[380px] shadow-xs">
            <MapView center={center} destination={destination} markers={markers} activeRoute={activeRoute} interactive className="h-full w-full" />
          </div>

          {snapshot.trip.status === 'AT_HOSPITAL' && (
            <p className="text-xs text-slate-600 font-medium">
              Hospital arrival was confirmed by the driver and persisted by the backend. Complete the trip to stop tracking.
            </p>
          )}
        </div>
      )}

      {socketError && <p role="status" className="text-xs text-amber-800 font-medium">{socketError}</p>}

    </section>
  );
};
