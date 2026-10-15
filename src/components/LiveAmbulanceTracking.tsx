import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Navigation, Radio, RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
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
  ASSIGNED: 'Assigned', ACCEPTED: 'Driver accepted · route to pickup', TO_PICKUP: 'En route to pickup',
  AT_PICKUP: 'Driver arrived at pickup', PATIENT_ONBOARD: 'Patient picked up',
  TO_HOSPITAL: 'En route to hospital', AT_HOSPITAL: 'Arrived at hospital',
  COMPLETED: 'Trip completed', CANCELLED: 'Trip cancelled',
};
const labelStatus = (status?: string) => statusLabels[status ?? ''] ?? status ?? 'Awaiting dispatch';
const formatAge = (ageMs: number | null | undefined) => {
  if (typeof ageMs !== 'number') return 'Update time unavailable';
  if (ageMs < 1000) return 'Updated just now';
  return `Updated ${Math.floor(ageMs / 1000)}s ago`;
};

export const LiveAmbulanceTracking = ({ emergencyRequestId, subscribeHospitalOperations = false }: LiveAmbulanceTrackingProps) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['tracking', 'emergency', emergencyRequestId] as const, [emergencyRequestId]);
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const snapshotQuery = useQuery({
    queryKey,
    queryFn: () => trackingApi.getEmergency(emergencyRequestId),
    enabled: Boolean(emergencyRequestId),
    staleTime: 0,
    refetchInterval: (query) => query.state.data?.trackingActive ? 15000 : 8000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const snapshot = snapshotQuery.data;

  useEffect(() => {
    if (!emergencyRequestId) return;
    const socket = createTrackingSocket();
    let disposed = false;
    const refresh = () => { void queryClient.invalidateQueries({ queryKey }); };
    socket.on('connect', () => {
      setConnected(true);
      setSocketError(null);
      void subscribeTrackingRoom(socket, { type: 'emergency', id: emergencyRequestId })
        .then(refresh)
        .catch((error: unknown) => { if (!disposed) setSocketError(error instanceof Error ? error.message : 'Live subscription failed.'); });
      if (subscribeHospitalOperations && snapshot?.hospital.id) {
        void subscribeTrackingRoom(socket, { type: 'hospital-operations', id: snapshot.hospital.id })
          .catch((error: unknown) => { if (!disposed) setSocketError(error instanceof Error ? error.message : 'Hospital realtime subscription failed.'); });
      }
      refresh();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => { setConnected(false); setSocketError('Realtime connection interrupted. Recovering through REST snapshots and automatic reconnect.'); });
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
  }, [emergencyRequestId, queryClient, queryKey, subscribeHospitalOperations, snapshot?.hospital.id]);
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

  if (snapshotQuery.isLoading) return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading authoritative tracking status…</section>;
  if (snapshotQuery.isError || !snapshot) return <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">Tracking snapshot could not be loaded. No live position is being inferred.</p><Button size="sm" variant="secondary" onClick={() => void snapshotQuery.refetch()} icon={<RefreshCw className="h-4 w-4" />}>Retry snapshot</Button></section>;

  return (
    <section className="resq-card rounded-2xl p-4 sm:p-5 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Ambulance Tracking</p>
          </div>
          <h3 className="mt-1 text-lg font-bold text-slate-950 tracking-tight">{snapshot.emergency.requestCode}</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 font-medium">
            {snapshot.trip?.status === 'ASSIGNED'
              ? 'Dispatch: assigned · awaiting driver acceptance'
              : snapshot.trip && snapshot.trackingActive
                ? labelStatus(snapshot.trip.status)
                : snapshot.trip && ['COMPLETED', 'CANCELLED'].includes(snapshot.trip.status)
                  ? labelStatus(snapshot.trip.status)
                  : snapshot.dispatch
                    ? `Dispatch: ${snapshot.dispatch.status.toLowerCase().replaceAll('_', ' ')}`
                    : 'Waiting for dispatch assignment'}
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
          {connected ? 'Realtime connected' : 'Reconnecting / REST recovery'}
        </span>
      </header>

      {(!snapshot.trip || snapshot.trip.status === 'ASSIGNED') && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-xs text-sky-950 flex items-start gap-2.5">
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 animate-pulse" />
          <p className="leading-relaxed">
            <strong>Dispatch in progress:</strong> Driver identity, vehicle number and live GPS telemetry will appear as soon as an assigned driver accepts the dispatch.
          </p>
        </div>
      )}

      {snapshot.trip && snapshot.trackingActive && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Assigned Unit</span>
            <p className="font-bold text-slate-900 text-sm sm:text-base">{snapshot.ambulance?.vehicleNumber ?? 'Assigned vehicle'}</p>
            <p className="text-xs text-slate-600 font-medium">
              {snapshot.ambulance?.ambulanceType ?? 'Type unavailable'} · {snapshot.ambulance?.driverName ?? 'Driver assigned'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Location Telemetry</span>
              {location?.coordinatesAreLive && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </div>
            <p className={`font-bold text-sm sm:text-base ${location?.coordinatesAreLive ? 'text-emerald-700' : 'text-amber-800'}`}>
              {location?.coordinatesAreLive ? 'Live GPS Feed' : location ? 'Last-Known Location · STALE' : 'Waiting for GPS fix'}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              {formatAge(location?.ageMs)}
              {location?.accuracyMeters ? ` · ±${Math.round(location.accuracyMeters)} m accuracy` : ''}
            </p>
          </div>
        </div>
      )}

      {snapshot.trip && !snapshot.trackingActive && ['COMPLETED', 'CANCELLED'].includes(snapshot.trip.status) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{labelStatus(snapshot.trip.status)}. Active GPS tracking has completed.</span>
        </div>
      )}

      {snapshot.trip && snapshot.trackingActive && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50 border border-teal-200/70 text-teal-900 text-xs font-bold">
              <MapPin className="h-3.5 w-3.5 text-teal-700" />
              <span>{routePhase === 'HOSPITAL' ? 'Ambulance → Destination Hospital' : 'Ambulance → Confirmed Pickup'}</span>
            </div>
            {routeQuery.isFetching && <span className="text-xs text-slate-500 font-medium">Refreshing route…</span>}
          </div>

          {routeQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <span>Google Routes is unavailable or GPS is stale. Map markers remain available; no arrival is inferred from the route.</span>
              <Button size="sm" variant="secondary" onClick={() => void routeQuery.refetch()}>Retry route</Button>
            </div>
          )}

          {routeQuery.data && activeRoute && (
            <div className="px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/80 text-xs text-slate-700 flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <span className="font-semibold">{activeRoute.distance}</span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-teal-800">{activeRoute.duration}</span>
              <span className="text-slate-400">•</span>
              <span className="text-[11px] text-slate-500">Google Routes updated {new Date(routeQuery.data.fetchedAt).toLocaleTimeString()}</span>
            </div>
          )}

          <div className="h-[300px] min-h-[280px] overflow-hidden rounded-xl border border-slate-200 sm:h-[380px] shadow-xs">
            <MapView center={center} destination={destination} markers={markers} activeRoute={activeRoute} interactive className="h-full w-full" />
          </div>

          {location && !location.coordinatesAreLive && (
            <p className="text-xs text-amber-800 font-medium">
              This marker is the last saved coordinate, not a live location. ResQ will recover when fresh driver telemetry arrives.
            </p>
          )}
          {snapshot.trip.status === 'AT_PICKUP' && (
            <p className="text-xs text-slate-600 font-medium">
              Driver arrival is confirmed by the backend trip action, not by map proximity.
            </p>
          )}
          {snapshot.trip.status === 'AT_HOSPITAL' && (
            <p className="text-xs text-slate-600 font-medium">
              Hospital arrival was confirmed by the driver and persisted by the backend. Complete the trip to stop tracking.
            </p>
          )}
        </div>
      )}

      {socketError && <p role="status" className="text-xs text-amber-800 font-medium">{socketError}</p>}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-[11px] text-slate-500">Authoritative trip state and location telemetry verified by ResQ backend.</p>
        <Button size="sm" variant="secondary" onClick={() => void snapshotQuery.refetch()} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          Refresh snapshot
        </Button>
      </footer>
    </section>
  );
};
