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
    return route && !routeQuery.isError ? trackingRouteOption(route) : null;
  }, [routeQuery.data, routeQuery.isError]);

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

  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live ambulance tracking</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{snapshot.emergency.requestCode}</h3><p className="mt-1 text-sm text-slate-600">{snapshot.trip ? labelStatus(snapshot.trip.status) : snapshot.dispatch ? `Dispatch: ${snapshot.dispatch.status.toLowerCase().replaceAll('_', ' ')}` : 'Waiting for dispatch assignment'}</p></div>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{connected ? 'Realtime connected' : 'Reconnecting / REST recovery'}</span>
    </header>

    {!snapshot.trip && <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"><Radio className="mr-2 inline h-4 w-4" />Dispatch progress only. Driver identity, vehicle details and GPS remain hidden until a driver accepts.</div>}
    {snapshot.trip && snapshot.trackingActive && <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Assigned ambulance</p><p className="mt-1 font-semibold">{snapshot.ambulance?.vehicleNumber ?? 'Assigned vehicle'}</p><p className="text-xs text-slate-500">{snapshot.ambulance?.ambulanceType ?? 'Type unavailable'} · {snapshot.ambulance?.driverName ?? 'Driver assigned'}</p></div>
      <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Location freshness</p><p className={`mt-1 font-semibold ${location?.coordinatesAreLive ? 'text-emerald-700' : 'text-amber-800'}`}>{location?.coordinatesAreLive ? 'Live GPS' : location ? 'Last-known location · STALE' : 'Waiting for first GPS fix'}</p><p className="mt-1 text-xs text-slate-500">{formatAge(location?.ageMs)}{location?.accuracyMeters ? ` · ±${Math.round(location.accuracyMeters)} m` : ''}</p></div>
    </div>}

    {snapshot.trip && !snapshot.trackingActive && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><ShieldCheck className="mr-2 inline h-4 w-4" />{labelStatus(snapshot.trip.status)}. Active GPS tracking has stopped.</div>}
    {snapshot.trip && snapshot.trackingActive && <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" />{routePhase === 'HOSPITAL' ? 'Ambulance → destination hospital' : 'Ambulance → confirmed pickup'}</p>{routeQuery.isFetching && <span className="text-xs text-slate-500">Refreshing route…</span>}</div>
      {routeQuery.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><span>Google Routes is unavailable or GPS is stale. Map markers remain available; no arrival is inferred from the route.</span><Button size="sm" variant="secondary" onClick={() => void routeQuery.refetch()}>Retry route</Button></div>}
      {routeQuery.data && activeRoute && <p className="text-xs text-slate-600"><Navigation className="mr-1 inline h-3.5 w-3.5" />{activeRoute.distance} · {activeRoute.duration} · Google Routes · updated {new Date(routeQuery.data.fetchedAt).toLocaleTimeString()}</p>}
      <div className="h-[300px] min-h-[280px] overflow-hidden rounded-lg border border-slate-200 sm:h-[380px]"><MapView center={center} destination={destination} markers={markers} activeRoute={activeRoute} interactive className="h-full w-full" /></div>
      {location && !location.coordinatesAreLive && <p className="text-xs text-amber-800">This marker is the last saved coordinate, not a live location. ResQ will recover when fresh driver telemetry arrives.</p>}
      {snapshot.trip.status === 'AT_PICKUP' && <p className="text-xs text-slate-600">Driver arrival is confirmed by the backend trip action, not by map proximity.</p>}
      {snapshot.trip.status === 'AT_HOSPITAL' && <p className="text-xs text-slate-600">Hospital arrival was confirmed by the driver and persisted by the backend. Complete the trip to stop tracking.</p>}
    </div>}

    {socketError && <p role="status" className="text-xs text-amber-800">{socketError}</p>}
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><p className="text-[11px] text-slate-500">Trip state and location timestamps come from the ResQ backend.</p><Button size="sm" variant="secondary" onClick={() => void snapshotQuery.refetch()} icon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh snapshot</Button></footer>
  </section>;
};
