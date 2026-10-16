import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Phone,
  MessageSquare,
  Share2,
  AlertTriangle,
  ChevronRight,
  Radio,
  RefreshCw,
  Calendar,
  Fuel,
  Battery,
  Satellite,
  Wind,
  TrendingUp,
  Truck,
  User,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { MapView } from '../../components/map/MapView';
import { ambulanceDriverApi } from '../../services/ambulanceDriverApi';
import { useAmbulanceRoute } from '../../hooks/useAmbulanceRoute';
import { trackingApi, trackingRouteOption } from '../../services/trackingApi';
import { useLocationState } from '../../hooks/useLocationState';
import { ROUTES } from '../../routes/routePaths';
import type { UserLocation } from '../../types/facility';
import type { RouteOptionItem } from '../../types/route';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LayoutContext {
  currentLocation: UserLocation;
  location: { latitude: number; longitude: number; accuracyMeters?: number; timestamp: number } | null;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported' | 'unknown';
  refreshLocation: () => void;
  isUpdating: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const geolocationErrorMessage = (error: GeolocationPositionError) => {
  if (error.code === error.PERMISSION_DENIED)
    return 'Location permission was denied. Enable location access in your browser settings to start or continue duty.';
  if (error.code === error.POSITION_UNAVAILABLE)
    return 'Your device could not determine its location. Move to an area with GPS reception and retry.';
  return 'GPS did not respond in time. ResQ will retry automatically while you remain on duty.';
};

const getCurrentGpsFix = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support GPS location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 12000,
    });
  });

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const DriverDashboardPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Location context from DriverLayout
  const outletContext = useOutletContext<LayoutContext | undefined>();
  const fallbackLocationState = useLocationState();
  const currentLocation = outletContext?.currentLocation ?? fallbackLocationState.currentLocation;
  const location = outletContext?.location ?? fallbackLocationState.location;
  const permissionState = outletContext?.permissionState ?? fallbackLocationState.permissionState;
  const refreshLocation = outletContext?.refreshLocation ?? fallbackLocationState.refreshLocation;

  // API queries
  const status = useQuery({
    queryKey: ['ambulance-driver', 'status'],
    queryFn: ambulanceDriverApi.getStatus,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const requests = useQuery({
    queryKey: ['ambulance-driver', 'requests'],
    queryFn: () => ambulanceDriverApi.getRequests({ limit: 20 }),
  });
  const offers = useQuery({
    queryKey: ['ambulance-driver', 'dispatch-offers'],
    queryFn: ambulanceDriverApi.getDispatchOffers,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });
  const trips = useQuery({
    queryKey: ['ambulance-driver', 'trips'],
    queryFn: () => ambulanceDriverApi.getTrips({ limit: 20 }),
  });

  const activeTrip = useMemo(
    () => trips.data?.items.find((t) => !['COMPLETED', 'CANCELLED'].includes(t.status)) ?? null,
    [trips.data?.items],
  );
  const completedTrips = useMemo(
    () => trips.data?.items.filter((t) => t.status === 'COMPLETED') ?? [],
    [trips.data?.items],
  );
  const cancelledTrips = useMemo(
    () => trips.data?.items.filter((t) => t.status === 'CANCELLED') ?? [],
    [trips.data?.items],
  );

  const activeRequest = useQuery({
    queryKey: ['ambulance-driver', 'request', activeTrip?.emergencyRequestId],
    queryFn: () => ambulanceDriverApi.getRequest(activeTrip!.emergencyRequestId),
    enabled: Boolean(activeTrip?.emergencyRequestId),
  });


  // Map destinations
  const destination = useMemo(
    () =>
      activeRequest.data &&
      typeof activeRequest.data.latitude === 'number' &&
      typeof activeRequest.data.longitude === 'number'
        ? { latitude: activeRequest.data.latitude, longitude: activeRequest.data.longitude }
        : null,
    [activeRequest.data],
  );
  const origin = useMemo(
    () => (location ? { latitude: location.latitude, longitude: location.longitude } : null),
    [location],
  );
  const toHospital =
    activeTrip?.status === 'PATIENT_ONBOARD' ||
    activeTrip?.status === 'TO_HOSPITAL' ||
    activeTrip?.status === 'AT_HOSPITAL';
  const hospitalLat = activeRequest.data?.hospitalLatitude;
  const hospitalLng = activeRequest.data?.hospitalLongitude;
  const routeDestination = useMemo(
    () =>
      toHospital
        ? typeof hospitalLat === 'number' && typeof hospitalLng === 'number'
          ? { latitude: hospitalLat, longitude: hospitalLng }
          : destination
        : destination,
    [toHospital, hospitalLat, hospitalLng, destination],
  );

  const route = useAmbulanceRoute(origin, destination, !activeTrip);
  const liveRoute = useQuery({
    queryKey: [
      'ambulance-driver',
      'live-route',
      activeTrip?.id,
      toHospital ? 'HOSPITAL' : 'PICKUP',
      origin?.latitude.toFixed(3),
      origin?.longitude.toFixed(3),
    ],
    queryFn: () => trackingApi.getRoute(activeTrip!.id),
    enabled: Boolean(
      activeTrip &&
        routeDestination &&
        status.data?.location?.coordinatesAreLive &&
        !['AT_HOSPITAL', 'COMPLETED', 'CANCELLED'].includes(activeTrip.status),
    ),
    staleTime: 18000,
    refetchInterval:
      activeTrip &&
      routeDestination &&
      status.data?.location?.coordinatesAreLive &&
      !['AT_HOSPITAL', 'COMPLETED', 'CANCELLED'].includes(activeTrip.status)
        ? 20000
        : false,
    retry: 1,
  });

  const routeItem: RouteOptionItem | null = activeTrip
    ? activeTrip.status === 'AT_HOSPITAL' || liveRoute.isError
      ? null
      : liveRoute.data?.routes[0]
        ? trackingRouteOption(liveRoute.data.routes[0])
        : null
    : route.routes[0] ?? null;

  // Map markers
  const mapMarkers = useMemo(() => {
    const list: { id: string; type?: 'HOSPITAL'; latitude: number; longitude: number; title: string; subtitle: string; isEmergency: boolean }[] = [];
    if (destination) {
      list.push({
        id: 'pickup',
        latitude: destination.latitude,
        longitude: destination.longitude,
        title: activeRequest.data?.location || 'Patient Pickup',
        subtitle: 'Pickup Location',
        isEmergency: true,
      });
    }
    if (routeDestination && toHospital) {
      list.push({
        id: 'hospital',
        type: 'HOSPITAL' as const,
        latitude: routeDestination.latitude,
        longitude: routeDestination.longitude,
        title: activeRequest.data?.hospitalName || 'Destination Hospital',
        subtitle: 'Emergency Intake',
        isEmergency: true,
      });
    }
    return list;
  }, [destination, routeDestination, toHospital, activeRequest.data?.location, activeRequest.data?.hospitalName]);

  // Location tracking
  const [locationHealth, setLocationHealth] = useState<'PAUSED' | 'TRACKING' | 'RETRYING' | 'ERROR'>('PAUSED');
  const [locationError, setLocationError] = useState('');
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
  const [trackingRestartToken] = useState(0);
  const lastGpsSentAtRef = useRef(0);
  const locationRequestInFlightRef = useRef(false);

  const invalidate = useCallback(
    () => Promise.all([qc.invalidateQueries({ queryKey: ['ambulance-driver'] })]),
    [qc],
  );

  // Duty mutations
  const startDutyMutation = useMutation({
    mutationFn: (fix: { latitude: number; longitude: number; accuracy: number; timestamp: number }) =>
      ambulanceDriverApi.startDuty(fix),
    onSuccess: async () => {
      lastGpsSentAtRef.current = Date.now();
      setGpsPermissionDenied(false);
      setLocationError('');
      setLocationHealth('RETRYING');
      await invalidate();
    },
  });

  const endDutyMutation = useMutation({
    mutationFn: () => ambulanceDriverApi.endDuty(),
    onSuccess: async () => {
      setLocationHealth('PAUSED');
      setLocationError('');
      lastGpsSentAtRef.current = 0;
      await invalidate();
    },
  });

  const startDuty = async () => {
    setLocationError('');
    setGpsPermissionDenied(false);
    try {
      const position = await getCurrentGpsFix();
      await startDutyMutation.mutateAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as GeolocationPositionError).code === 1
      )
        setGpsPermissionDenied(true);
      setLocationHealth('ERROR');
      setLocationError(
        error instanceof Error ? error.message : 'Unable to start duty. Check GPS permission and retry.',
      );
    }
  };

  // GPS tracking loop
  useEffect(() => {
    const dutyStatus = status.data?.status;
    let disposed = false;
    if (dutyStatus !== 'ONLINE' && dutyStatus !== 'BUSY') return;
    if (!navigator.geolocation) {
      queueMicrotask(() => {
        if (!disposed) {
          setLocationHealth('ERROR');
          setLocationError('This browser does not support GPS.');
        }
      });
      return () => { disposed = true; };
    }
    const intervalMs = Math.min(5000, Math.max(3000, status.data?.trackingIntervalMs ?? 4000));
    let permissionFailureHandled = false;
    const requestFix = () => {
      if (disposed || locationRequestInFlightRef.current) return;
      locationRequestInFlightRef.current = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (disposed) { locationRequestInFlightRef.current = false; return; }
          setGpsPermissionDenied(false);
          lastGpsSentAtRef.current = Date.now();
          void ambulanceDriverApi
            .updateLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            })
            .then(() => { setLocationError(''); setLocationHealth('TRACKING'); })
            .catch((error) => {
              setLocationError(error instanceof Error ? error.message : 'GPS update failed.');
              setLocationHealth('RETRYING');
            })
            .finally(() => { locationRequestInFlightRef.current = false; });
        },
        (error) => {
          locationRequestInFlightRef.current = false;
          if (error.code === error.PERMISSION_DENIED) {
            window.clearInterval(timer);
            setGpsPermissionDenied(true);
            setLocationHealth('ERROR');
            setLocationError(geolocationErrorMessage(error));
            if (!permissionFailureHandled && dutyStatus === 'ONLINE') {
              permissionFailureHandled = true;
              void ambulanceDriverApi.endDuty().then(() => invalidate()).catch(() => {});
            }
          } else {
            setLocationHealth('RETRYING');
            setLocationError(geolocationErrorMessage(error));
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
      );
    };
    const timer = window.setInterval(requestFix, intervalMs);
    queueMicrotask(() => { if (!disposed) setLocationHealth('RETRYING'); });
    requestFix();
    return () => { disposed = true; window.clearInterval(timer); locationRequestInFlightRef.current = false; };
  }, [status.data?.status, status.data?.trackingIntervalMs, invalidate, trackingRestartToken]);

  // Dispatch offer accept/reject
  const acceptOffer = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.acceptDispatchOffer(id),
    onSuccess: async () => {
      await invalidate();
      await qc.invalidateQueries({ queryKey: ['ambulance-driver', 'dispatch-offers'] });
      navigate(ROUTES.DRIVER.NAVIGATION('active'));
    },
  });
  const rejectOffer = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.rejectDispatchOffer(id),
    onSuccess: async () => {
      await invalidate();
      await qc.invalidateQueries({ queryKey: ['ambulance-driver', 'dispatch-offers'] });
    },
  });

  // Derived data
  const isOnDuty = status.data?.status === 'ONLINE' || status.data?.status === 'BUSY';
  const incomingOffer = offers.data?.[0] ?? null;
  const vehicleInfo = status.data?.assignedAmbulance;
  const todayTrips = trips.data?.items ?? [];

  // Nearby requests for the "Available Requests Nearby" panel
  const availableRequests = useMemo(
    () =>
      (requests.data?.items ?? [])
        .filter((r) => !r.driverId && ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(r.status))
        .slice(0, 5),
    [requests.data?.items],
  );

  const priorityColor = (situationType: string) => {
    const s = situationType.toLowerCase();
    if (/accident|trauma|chest|stroke|unconscious|severe/.test(s)) return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'High' };
    if (/breathing|burn/.test(s)) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' };
    return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Low' };
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8 space-y-5">

        {/* ── Hero Banner ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 p-6 sm:p-8 text-white">
          <div className="relative z-10 max-w-lg">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight">
              Be the difference<br />in someone's life.
            </h1>
            <p className="mt-2 text-sm text-blue-200 font-medium">
              Reach faster. Save lives. Together with ResQ.
            </p>
          </div>
          {/* Decorative ambulance silhouette */}
          <div className="absolute right-0 top-0 h-full w-1/3 opacity-20">
            <Truck className="h-full w-full" />
          </div>
        </div>

        {/* ── Stats Cards Row ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Current Status */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isOnDuty ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                <CheckCircle2 className={`h-5 w-5 ${isOnDuty ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current Status</p>
                <p className={`text-sm font-bold ${isOnDuty ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {isOnDuty ? '● On Duty' : '○ Off Duty'}
                </p>
                <p className="text-[10px] text-slate-400">{isOnDuty ? 'Available for requests' : 'Not accepting requests'}</p>
              </div>
            </div>
          </div>

          {/* Active Request */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${activeTrip ? 'bg-rose-100' : 'bg-slate-100'}`}>
                <AlertTriangle className={`h-5 w-5 ${activeTrip ? 'text-rose-600' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Request</p>
                <p className="text-xl font-black text-slate-900">{activeTrip ? '1' : '0'}</p>
                <p className="text-[10px] text-slate-400">
                  {activeTrip ? `${activeTrip.status.replace(/_/g, ' ').toLowerCase()}` : 'No active trips'}
                </p>
              </div>
            </div>
          </div>

          {/* Today's Trips */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <Navigation className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Today's Trips</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-black text-slate-900">{todayTrips.length}</p>
                  {completedTrips.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  {completedTrips.length} completed, {activeTrip ? '1 ongoing' : '0 ongoing'}
                </p>
              </div>
            </div>
          </div>

          {/* Total Hours */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                <Clock className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Duty Status</p>
                <p className="text-sm font-bold text-slate-900">{status.data?.dutyState ?? 'OFF_DUTY'}</p>
                <p className="text-[10px] text-slate-400">
                  {status.data?.updatedAt ? `Since ${new Date(status.data.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : "Today's duty"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Vehicle & Driver Status + Duty Toggle ─────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Truck className="h-7 w-7 text-slate-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Vehicle & Driver Status</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${isOnDuty ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {isOnDuty ? 'On Duty' : 'Off Duty'}
                  </span>
                </div>
                {vehicleInfo ? (
                  <>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {vehicleInfo.vehicleNumber} · {vehicleInfo.registrationNumber}
                    </p>
                    <p className="text-xs text-slate-500">{vehicleInfo.ambulanceType}</p>
                  </>
                ) : (
                  <p className="text-xs text-rose-600 mt-0.5">No ambulance assigned</p>
                )}
              </div>
            </div>

            {/* Vehicle telemetry indicators */}
            {vehicleInfo && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <Fuel className="h-4 w-4 text-amber-500" />
                  <span className="text-[10px] font-bold text-slate-700 mt-0.5">Fuel</span>
                  <span className="text-[10px] text-slate-500">—</span>
                </div>
                <div className="flex flex-col items-center">
                  <Battery className="h-4 w-4 text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-700 mt-0.5">Battery</span>
                  <span className="text-[10px] text-slate-500">—</span>
                </div>
                <div className="flex flex-col items-center">
                  <Satellite className={`h-4 w-4 ${locationHealth === 'TRACKING' ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className="text-[10px] font-bold text-slate-700 mt-0.5">GPS</span>
                  <span className="text-[10px] text-slate-500">{locationHealth === 'TRACKING' ? 'Online' : 'Offline'}</span>
                </div>
                <div className="flex flex-col items-center">
                  <Wind className="h-4 w-4 text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-700 mt-0.5">AC</span>
                  <span className="text-[10px] text-slate-500">—</span>
                </div>
              </div>
            )}

            {/* Duty toggle */}
            <div className="flex items-center gap-2">
              {status.data?.status === 'BUSY' && status.data.activeTrip ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    navigate(
                      activeTrip?.status === 'AT_PICKUP' || activeTrip?.status === 'AT_HOSPITAL'
                        ? ROUTES.DRIVER.TRIPS
                        : ROUTES.DRIVER.NAVIGATION('active'),
                    )
                  }
                  icon={<Navigation className="h-4 w-4" />}
                >
                  Resume Trip
                </Button>
              ) : status.data?.status === 'ONLINE' || status.data?.status === 'BUSY' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => endDutyMutation.mutate()}
                  disabled={!status.data?.canEndDuty || endDutyMutation.isPending}
                >
                  {endDutyMutation.isPending ? 'Ending…' : 'Go Offline'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void startDuty()}
                  disabled={!status.data?.canStartDuty || startDutyMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20"
                  icon={<Radio className="h-4 w-4" />}
                >
                  {startDutyMutation.isPending ? 'Connecting GPS…' : 'Go Online'}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => void invalidate()} icon={<RefreshCw className="h-3.5 w-3.5" />} title="Refresh" />
            </div>
          </div>

          {/* Error messages */}
          {locationError && (
            <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              {locationError}
            </p>
          )}
          {gpsPermissionDenied && (
            <p className="mt-2 text-xs text-rose-700">
              GPS permission is denied. Change browser site settings and retry.
            </p>
          )}
          {startDutyMutation.isError && (
            <p role="alert" className="mt-2 text-xs text-rose-700">
              {startDutyMutation.error instanceof Error ? startDutyMutation.error.message : 'Could not start duty.'}
            </p>
          )}
        </div>

        {/* ── Main Content Grid ────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-5">

          {/* ── Left Column: Live Route & Navigation (3 cols) ──── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Live Route & Navigation */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h2 className="text-sm font-bold text-slate-900">Live Route & Navigation</h2>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-blue-600" /> Your Location</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-rose-600" /> Patient Location</span>
                  <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-blue-600 rounded" /> Route</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-emerald-600" /> Hospital</span>
                </div>
              </div>

              {/* Map */}
              <div className="h-[350px] sm:h-[400px]">
                <MapView
                  userLocation={currentLocation}
                  center={origin ?? undefined}
                  markers={mapMarkers}
                  activeRoute={routeItem}
                  interactive
                  className="h-full w-full"
                />
              </div>

              {/* ETA bar under map */}
              {routeItem && (
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-blue-50">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] text-blue-600 font-semibold">ETA</p>
                      <p className="text-sm font-bold text-slate-900">{routeItem.duration}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">{routeItem.distance}</p>
                </div>
              )}
            </div>

            {permissionState !== 'granted' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Location access is required for real navigation.{' '}
                <button className="font-semibold underline" onClick={refreshLocation}>
                  Enable location
                </button>
              </div>
            )}

            {/* ── Bottom Row: Today's Activity + Earnings ───────── */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Today's Activity */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Today's Activity</h3>
                  <button
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                    onClick={() => navigate(ROUTES.DRIVER.TRIPS)}
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {todayTrips.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No trips today</p>
                  ) : (
                    todayTrips.slice(0, 3).map((trip) => (
                      <div key={trip.id} className="flex items-start gap-3">
                        <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${trip.status === 'COMPLETED' ? 'bg-emerald-500' : trip.status === 'CANCELLED' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            Trip #{trip.id.slice(-4).toUpperCase()}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {trip.createdAt ? new Date(trip.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${trip.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : trip.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                          {trip.status === 'COMPLETED' ? 'Completed' : trip.status === 'CANCELLED' ? 'Cancelled' : 'Active'}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Earnings summary (placeholder) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Trip Summary (Today)</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Completed Trips</span>
                    <span className="text-sm font-bold text-slate-900">{completedTrips.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Ongoing Trips</span>
                    <span className="text-sm font-bold text-slate-900">{activeTrip ? 1 : 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Cancelled Trips</span>
                    <span className="text-sm font-bold text-slate-900">{cancelledTrips.length}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Total Distance</span>
                    <span className="text-sm font-bold text-slate-900">—</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Current Assignment + Quick Actions + Nearby (2 cols) ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Current Assignment */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Current Assignment</h3>
                {activeTrip && (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                    Emergency
                  </span>
                )}
              </div>

              {activeTrip && activeRequest.data ? (
                <div className="space-y-3">
                  {/* Patient info */}
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-500">Patient</p>
                      <p className="text-xs font-semibold text-slate-800">Emergency Patient</p>
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    <div>
                      <p className="text-[10px] text-slate-500">Condition</p>
                      <p className="text-xs font-semibold text-slate-800">{activeRequest.data.situationType}</p>
                    </div>
                  </div>

                  {/* Distance */}
                  {activeRequest.data.etaMinutes && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-rose-500" />
                      <div>
                        <p className="text-[10px] text-slate-500">Estimated Arrival</p>
                        <p className="text-xs font-semibold text-slate-800">{activeRequest.data.etaMinutes} minutes</p>
                      </div>
                    </div>
                  )}

                  {/* Pickup Location */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <div>
                        <p className="text-[10px] text-slate-500">Pickup Location</p>
                        <p className="text-xs font-semibold text-slate-800">{activeRequest.data.location || 'Dispatch coordinates'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="h-6 w-6 rounded-full bg-blue-50 flex items-center justify-center">
                        <Phone className="h-3 w-3 text-blue-600" />
                      </button>
                      <button className="h-6 w-6 rounded-full bg-blue-50 flex items-center justify-center">
                        <Navigation className="h-3 w-3 text-blue-600" />
                      </button>
                    </div>
                  </div>

                  {/* Drop-off Hospital */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-[10px] text-slate-500">Drop-off Hospital</p>
                        <p className="text-xs font-semibold text-slate-800">{activeRequest.data.hospitalName || 'Destination Hospital'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="h-6 w-6 rounded-full bg-blue-50 flex items-center justify-center">
                        <Phone className="h-3 w-3 text-blue-600" />
                      </button>
                      <button className="h-6 w-6 rounded-full bg-blue-50 flex items-center justify-center">
                        <Navigation className="h-3 w-3 text-blue-600" />
                      </button>
                    </div>
                  </div>

                  {/* Navigate with Maps button */}
                  <Button
                    variant="primary"
                    fullWidth
                    size="md"
                    className="mt-2 bg-blue-600 hover:bg-blue-700"
                    icon={<Navigation className="h-4 w-4" />}
                    onClick={() => navigate(ROUTES.DRIVER.NAVIGATION('active'))}
                  >
                    Navigate with Maps
                  </Button>

                  {/* Mark as Arrived */}
                  <button
                    className="w-full text-center text-xs font-semibold text-blue-600 hover:underline py-1"
                    onClick={() => navigate(ROUTES.DRIVER.TRIPS)}
                  >
                    Trip Actions →
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Navigation className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No active assignment</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isOnDuty ? 'Waiting for dispatch…' : 'Go online to receive requests'}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-4 gap-2">
                <button
                  className="flex flex-col items-center gap-1.5 rounded-xl p-3 hover:bg-slate-50 transition"
                  onClick={() => window.location.assign('tel:112')}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700">Emergency<br />Alert</span>
                </button>
                <button
                  className="flex flex-col items-center gap-1.5 rounded-xl p-3 hover:bg-slate-50 transition"
                  onClick={() => {
                    const phone = activeRequest.data?.hospitalName ? '112' : '112';
                    window.location.assign(`tel:${phone}`);
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700">Call<br />Hospital</span>
                </button>
                <button className="flex flex-col items-center gap-1.5 rounded-xl p-3 hover:bg-slate-50 transition">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                    <MessageSquare className="h-5 w-5 text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700">Message<br />Coordinator</span>
                </button>
                <button
                  className="flex flex-col items-center gap-1.5 rounded-xl p-3 hover:bg-slate-50 transition"
                  onClick={() => {
                    if (navigator.share && location) {
                      void navigator.share({
                        title: 'ResQ Ambulance Location',
                        text: `Ambulance location: ${location.latitude}, ${location.longitude}`,
                        url: `https://maps.google.com/?q=${location.latitude},${location.longitude}`,
                      });
                    }
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                    <Share2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700">Share<br />Location</span>
                </button>
              </div>
            </div>

            {/* Available Requests Nearby */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Available Requests Nearby</h3>
                <button
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                  onClick={() => navigate(ROUTES.DRIVER.ASSIGNMENTS)}
                >
                  View All
                </button>
              </div>

              {availableRequests.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No available requests nearby</p>
                  <p className="text-[10px] text-slate-400 mt-1">New emergency requests will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableRequests.map((req) => {
                    const priority = priorityColor(req.situationType);
                    return (
                      <div key={req.id} className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${priority.bg}`}>
                          <AlertTriangle className={`h-4 w-4 ${priority.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold ${priority.text}`}>{priority.label}</span>
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {req.situationType}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-500">{req.location || 'Location pending'}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          className="text-[10px] px-3 py-1 h-7 bg-blue-600 hover:bg-blue-700"
                          onClick={() => navigate(ROUTES.DRIVER.ASSIGNMENT_DETAIL(req.id))}
                        >
                          Accept
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Duty Schedule */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Upcoming Duty Schedule</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Today</p>
                      <p className="text-[10px] text-slate-500">
                        {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isOnDuty ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {isOnDuty ? 'On Duty' : 'Off Duty'}
                  </span>
                </div>
              </div>
            </div>

            {/* Emergency helpline */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-900">Need Support?</p>
                  <p className="text-[10px] text-blue-700">24×7 Driver Helpline</p>
                </div>
                <a
                  href="tel:112"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  Call 112
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dispatch Offer Modal Overlay ─────────────────────── */}
      {incomingOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Incoming Dispatch</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Emergency Request</h2>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
                <Clock className="h-4 w-4" />
                Active
              </span>
            </div>

            {incomingOffer.request && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
                <div>
                  <p className="text-[10px] text-slate-500">Request Code</p>
                  <p className="font-mono text-sm font-bold text-slate-900">{incomingOffer.request.requestCode}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Emergency Type</p>
                  <p className="text-sm font-semibold text-slate-900">{incomingOffer.request.situationType}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Pickup</p>
                  <p className="text-sm font-semibold text-slate-900">{incomingOffer.request.pickup.label || 'Dispatch coordinates'}</p>
                </div>
                {incomingOffer.hospital && (
                  <div>
                    <p className="text-[10px] text-slate-500">Hospital</p>
                    <p className="text-sm font-semibold text-slate-900">{incomingOffer.hospital.name}</p>
                  </div>
                )}
                {incomingOffer.route && (
                  <div>
                    <p className="text-[10px] text-slate-500">Distance</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {(incomingOffer.route.distanceMeters / 1000).toFixed(1)} km
                      {typeof incomingOffer.route.etaSeconds === 'number' && ` · ${Math.max(1, Math.round(incomingOffer.route.etaSeconds / 60))} min`}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                variant="emergency"
                fullWidth
                onClick={() => acceptOffer.mutate(incomingOffer.dispatchJobId)}
                disabled={acceptOffer.isPending || rejectOffer.isPending}
                className="min-h-12 font-bold"
              >
                {acceptOffer.isPending ? 'Accepting…' : 'Accept Dispatch'}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                fullWidth
                onClick={() => rejectOffer.mutate(incomingOffer.dispatchJobId)}
                disabled={rejectOffer.isPending || acceptOffer.isPending}
                className="min-h-12"
              >
                {rejectOffer.isPending ? 'Declining…' : 'Decline'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
