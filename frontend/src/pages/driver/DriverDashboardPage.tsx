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
  Radio,
  Calendar,
  Fuel,
  Battery,
  Satellite,
  Wind,
  TrendingUp,
  Truck,
  User,
  ArrowRight,
} from 'lucide-react';
import { MapView } from '../../components/map/MapView';
import { darkMapStyle } from '../../components/map/darkMapStyle';
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
      toHospital && typeof hospitalLat === 'number' && typeof hospitalLng === 'number'
        ? { latitude: hospitalLat, longitude: hospitalLng }
        : destination,
    [toHospital, hospitalLat, hospitalLng, destination],
  );

  // Live route calculation hook
  const { routes: calculatedRoutes } = useAmbulanceRoute(
    origin,
    routeDestination,
    Boolean(origin && routeDestination),
  );

  // Tracking route option fallback from trackingApi
  const trackingRouteQuery = useQuery({
    queryKey: ['driver-tracking-route', activeTrip?.emergencyRequestId],
    queryFn: () => trackingApi.getRoute(activeTrip!.emergencyRequestId),
    enabled: Boolean(activeTrip?.emergencyRequestId && (!calculatedRoutes || calculatedRoutes.length === 0)),
    staleTime: 10000,
  });

  const routeItem: RouteOptionItem | null = useMemo(() => {
    if (calculatedRoutes && calculatedRoutes.length > 0) {
      return calculatedRoutes[0];
    }
    if (trackingRouteQuery.data?.routes?.[0]) {
      return trackingRouteOption(trackingRouteQuery.data.routes[0]);
    }
    return null;
  }, [calculatedRoutes, trackingRouteQuery.data]);

  // Map markers
  const mapMarkers = useMemo(() => {
    const list: Array<{
      id: string;
      latitude: number;
      longitude: number;
      title: string;
      type: 'USER' | 'AMBULANCE' | 'HOSPITAL' | 'DEFAULT';
      subtitle?: string;
      isEmergency?: boolean;
    }> = [];
    if (location) {
      list.push({
        id: 'me',
        latitude: location.latitude,
        longitude: location.longitude,
        title: 'Your Location',
        type: 'AMBULANCE',
        subtitle: status.data?.assignedAmbulance?.registrationNumber || 'RJ-14-EA-1001',
      });
    }
    if (destination) {
      list.push({
        id: 'patient',
        latitude: destination.latitude,
        longitude: destination.longitude,
        title: 'Patient Location',
        type: 'DEFAULT',
        subtitle: activeRequest.data?.situationType,
        isEmergency: true,
      });
    }
    if (hospitalLat && hospitalLng) {
      list.push({
        id: 'hospital',
        latitude: hospitalLat,
        longitude: hospitalLng,
        title: activeRequest.data?.hospitalName || 'Destination Hospital',
        type: 'HOSPITAL',
      });
    }
    return list;
  }, [location, destination, hospitalLat, hospitalLng, status.data?.assignedAmbulance, activeRequest.data]);

  // Duty mutations
  const [locationHealth, setLocationHealth] = useState<'IDLE' | 'TRACKING' | 'RETRYING' | 'ERROR'>('IDLE');
  const [locationError, setLocationError] = useState<string>('');
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState<boolean>(false);
  const [trackingRestartToken, setTrackingRestartToken] = useState<number>(0);

  const invalidate = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['ambulance-driver', 'status'] }),
      qc.invalidateQueries({ queryKey: ['ambulance-driver', 'trips'] }),
      qc.invalidateQueries({ queryKey: ['ambulance-driver', 'requests'] }),
    ]);
  }, [qc]);

  const startDutyMutation = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number; accuracy: number; timestamp: number }) =>
      ambulanceDriverApi.startDuty(coords),
    onSuccess: async () => {
      setLocationError('');
      setGpsPermissionDenied(false);
      setTrackingRestartToken((prev) => prev + 1);
      await invalidate();
    },
    onError: (err: unknown) => {
      setLocationError(err instanceof Error ? err.message : 'Could not go on duty.');
    },
  });

  const endDutyMutation = useMutation({
    mutationFn: () => ambulanceDriverApi.endDuty(),
    onSuccess: async () => {
      setLocationHealth('IDLE');
      setLocationError('');
      setTrackingRestartToken((prev) => prev + 1);
      await invalidate();
    },
  });

  const startDuty = async () => {
    setLocationError('');
    setGpsPermissionDenied(false);
    try {
      const fix = await getCurrentGpsFix();
      await startDutyMutation.mutateAsync({
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracy: fix.coords.accuracy,
        timestamp: fix.timestamp,
      });
    } catch (gpsErr) {
      if (typeof GeolocationPositionError !== 'undefined' && gpsErr instanceof GeolocationPositionError) {
        if (gpsErr.code === gpsErr.PERMISSION_DENIED) setGpsPermissionDenied(true);
        setLocationError(geolocationErrorMessage(gpsErr));
      } else if (gpsErr instanceof Error) {
        setLocationError(gpsErr.message);
      } else {
        setLocationError('Could not obtain GPS fix to start duty.');
      }
    }
  };

  // Background GPS Telemetry Loop
  const locationRequestInFlightRef = useRef(false);
  const lastGpsSentAtRef = useRef(0);

  useEffect(() => {
    const dutyStatus = status.data?.status;
    if (dutyStatus !== 'ONLINE' && dutyStatus !== 'BUSY') {
      setLocationHealth('IDLE');
      return;
    }
    const intervalMs = Math.max(3000, status.data?.trackingIntervalMs ?? 5000);
    let disposed = false;
    let permissionFailureHandled = false;
    const requestFix = () => {
      if (disposed || locationRequestInFlightRef.current) return;
      locationRequestInFlightRef.current = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (disposed) {
            locationRequestInFlightRef.current = false;
            return;
          }
          setGpsPermissionDenied(false);
          lastGpsSentAtRef.current = Date.now();
          void ambulanceDriverApi
            .updateLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            })
            .then(() => {
              setLocationError('');
              setLocationHealth('TRACKING');
            })
            .catch((error) => {
              setLocationError(error instanceof Error ? error.message : 'GPS update failed.');
              setLocationHealth('RETRYING');
            })
            .finally(() => {
              locationRequestInFlightRef.current = false;
            });
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
    queueMicrotask(() => {
      if (!disposed) setLocationHealth('RETRYING');
    });
    requestFix();
    return () => {
      disposed = true;
      window.clearInterval(timer);
      locationRequestInFlightRef.current = false;
    };
  }, [status.data?.status, status.data?.trackingIntervalMs, invalidate, trackingRestartToken]);

  // Dispatch offers
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

  // Derived state
  const isOnDuty = status.data?.status === 'ONLINE' || status.data?.status === 'BUSY';
  const incomingOffer = offers.data?.[0] ?? null;
  const vehicleInfo = status.data?.assignedAmbulance;
  const todayTrips = trips.data?.items ?? [];

  const availableRequests = useMemo(
    () =>
      (requests.data?.items ?? [])
        .filter((r) => !r.driverId && ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(r.status))
        .slice(0, 5),
    [requests.data?.items],
  );

  const priorityBadge = (situationType: string) => {
    const s = situationType.toLowerCase();
    if (/accident|trauma|chest|stroke|unconscious|severe/.test(s))
      return { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30', label: 'CRITICAL' };
    if (/breathing|burn/.test(s))
      return { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', label: 'HIGH' };
    return { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30', label: 'STANDARD' };
  };

  return (
    <div className="flex flex-1 flex-col bg-[#070709] text-zinc-100 font-sans p-4 sm:p-6 lg:p-8 space-y-6">

      {/* ─── Incoming Urgent Dispatch Offer Alert (Uber-Style Modal/Pill) ──── */}
      {incomingOffer && (
        <div className="rounded-2xl p-6 bg-gradient-to-r from-rose-950/80 via-zinc-950 to-zinc-950 border-2 border-rose-500 shadow-2xl shadow-rose-950/80 animate-pulse">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-950/80">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400 font-bold">
                  NEW EMERGENCY ASSIGNMENT OFFER
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {incomingOffer.request?.situationType || 'Immediate Incident Response'}
                </h3>
                <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-400" />
                  <span>{incomingOffer.request?.pickup?.label || incomingOffer.hospital?.name || 'Incident Target Coordinates'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => rejectOffer.mutate(incomingOffer.dispatchJobId)}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] transition cursor-pointer"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => acceptOffer.mutate(incomingOffer.dispatchJobId)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-xs font-black text-white shadow-xl shadow-rose-950/80 transition cursor-pointer active:scale-95"
              >
                Accept & Start Route
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Location Permission Telemetry Banner ─── */}
      {(gpsPermissionDenied || permissionState === 'denied') && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>Location access is disabled. Enable browser location services for live fleet dispatch and tracking.</span>
          </div>
          <button
            type="button"
            onClick={refreshLocation}
            className="px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 transition text-xs font-semibold cursor-pointer self-start sm:self-auto"
          >
            Refresh GPS
          </button>
        </div>
      )}

      {/* ─── Hero Banner & Duty Telemetry: Dark Glass Mesh Card ─────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950/20 via-zinc-900/60 to-zinc-950/80 border border-white/10 p-8 backdrop-blur-xl shadow-2xl">
        {/* Soft atmospheric ambient glow */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl opacity-20 bg-rose-500" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-zinc-300 mb-3 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Jaipur City Responder Telemetry Grid</span>
            </div>
            {/* Header Typography: Clean font structure with high line-height */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white leading-tight tracking-tight">
              Be the difference <br />
              <span className="font-bold bg-gradient-to-r from-rose-400 via-rose-300 to-amber-300 bg-clip-text text-transparent">
                in someone's life.
              </span>
            </h1>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed font-normal">
              Sub-second dispatch telemetry · Rapid patient recovery · ResQ 2.O Responder Grid
            </p>
          </div>

          {/* Duty Toggle Control: Illuminated Dark Glass Pill */}
          <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
            {status.data?.status === 'BUSY' && status.data.activeTrip ? (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    activeTrip?.status === 'AT_PICKUP' || activeTrip?.status === 'AT_HOSPITAL'
                      ? ROUTES.DRIVER.TRIPS
                      : ROUTES.DRIVER.NAVIGATION('active'),
                  )
                }
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-xl shadow-rose-950/80 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Navigation className="h-4 w-4 animate-pulse" />
                <span>Resume Active Mission</span>
              </button>
            ) : status.data?.status === 'ONLINE' || status.data?.status === 'BUSY' ? (
              <button
                type="button"
                onClick={() => endDutyMutation.mutate()}
                disabled={!status.data?.canEndDuty || endDutyMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 shadow-lg shadow-rose-950/40 transition-all cursor-pointer disabled:opacity-50"
              >
                <Radio className="h-4 w-4 text-rose-400" />
                <span>{endDutyMutation.isPending ? 'Ending Shift…' : 'Go Offline'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startDuty()}
                disabled={!status.data?.canStartDuty || startDutyMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 shadow-lg shadow-emerald-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>{startDutyMutation.isPending ? 'Connecting GPS…' : 'Go Online'}</span>
              </button>
            )}

            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <span className={`h-2 w-2 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span>{isOnDuty ? 'Ready for GPS Emergency Dispatch' : 'Duty Suspended / Off Duty'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4 Spacious Bento Metric Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Card 1: Current Status */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Current Status</span>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isOnDuty
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/[0.05] text-zinc-400 border border-white/10'
              }`}
            >
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          {/* Telemetry Typography: JetBrains Mono monospace font */}
          <p className={`font-mono text-2xl font-light tracking-tight ${isOnDuty ? 'text-emerald-300' : 'text-zinc-400'}`}>
            {isOnDuty ? '● ON DUTY' : '○ OFF DUTY'}
          </p>
          <p className="text-[11px] text-zinc-400 leading-snug">
            {isOnDuty ? 'Available for emergency dispatch' : 'Standby / Stationed at depot'}
          </p>
        </div>

        {/* Card 2: Active Request */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Active Request</span>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                activeTrip
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-white/[0.05] text-zinc-400 border border-white/10'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="font-mono text-3xl font-light text-zinc-100 tracking-tight">
            {activeTrip ? '1' : '0'}
          </p>
          <p className="text-[11px] text-zinc-400 leading-snug">
            {activeTrip ? activeTrip.status.replace(/_/g, ' ').toLowerCase() : 'No active incident mission'}
          </p>
        </div>

        {/* Card 3: Today's Trips */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Today's Trips</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Navigation className="h-5 w-5" />
            </div>
          </div>
          <p className="font-mono text-3xl font-light text-zinc-100 tracking-tight">
            {todayTrips.length}
          </p>
          <p className="text-[11px] text-zinc-400 leading-snug">
            <span className="font-mono text-emerald-400 font-semibold">{completedTrips.length}</span> completed ·{' '}
            <span className="font-mono text-rose-400 font-semibold">{activeTrip ? '1' : '0'}</span> ongoing
          </p>
        </div>

        {/* Card 4: Duty Status */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Duty Telemetry</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="font-mono text-xl font-light text-zinc-100 tracking-tight">
            {status.data?.dutyState ?? (isOnDuty ? 'ACTIVE' : 'OFFLINE')}
          </p>
          <p className="font-mono text-[11px] text-zinc-400 leading-snug">
            {status.data?.updatedAt
              ? `Since ${new Date(status.data.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Shift ready'}
          </p>
        </div>
      </div>

      {/* ─── Vehicle Health Card & Assigned Ambulance ─────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-md shadow-rose-950/40 shrink-0">
              <Truck className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Assigned Ambulance & Unit Health</h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    isOnDuty
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                      : 'bg-white/[0.05] border border-white/10 text-zinc-400'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  {isOnDuty ? 'On Duty' : 'Off Duty'}
                </span>
              </div>
              {vehicleInfo ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-zinc-100">
                    {vehicleInfo.registrationNumber}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono text-xs text-rose-400 font-semibold">{vehicleInfo.vehicleNumber}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-xs text-zinc-400">{vehicleInfo.ambulanceType}</span>
                </div>
              ) : (
                <p className="text-xs text-rose-400 mt-1">Default Unit Assigned · Ready for inspection</p>
              )}
            </div>
          </div>

          {/* Vehicle Health Card detailing Fuel, Battery, GPS, AC status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Fuel */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-amber-500/30 transition-all min-w-[80px]">
              <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                <Fuel className="h-4 w-4" />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Fuel</span>
              <span className="font-mono text-xs font-bold text-amber-300 mt-0.5">88%</span>
            </div>

            {/* Battery */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 transition-all min-w-[80px]">
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                <Battery className="h-4 w-4" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Battery</span>
              <span className="font-mono text-xs font-bold text-emerald-300 mt-0.5">13.8V</span>
            </div>

            {/* GPS */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-rose-500/30 transition-all min-w-[80px]">
              <div className="flex items-center gap-1.5 text-rose-400 mb-1">
                <Satellite className="h-4 w-4" />
                <span className={`h-1.5 w-1.5 rounded-full ${locationHealth === 'TRACKING' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">GPS</span>
              <span className="font-mono text-xs font-bold text-zinc-200 mt-0.5">
                {locationHealth === 'TRACKING' ? '3m Fix' : 'Retrying'}
              </span>
            </div>

            {/* AC */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-blue-500/30 transition-all min-w-[80px]">
              <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                <Wind className="h-4 w-4" />
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Cabin AC</span>
              <span className="font-mono text-xs font-bold text-blue-300 mt-0.5">21°C</span>
            </div>
          </div>
        </div>

        {/* Telemetry error notice if any */}
        {locationError && (
          <p role="alert" className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            {locationError}
          </p>
        )}
      </div>

      {/* ─── Main Content Grid: Live Map (Left 3 cols) + Assignment Feed (Right 2 cols) ─ */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* LEFT COLUMN: Live Route Map (3 cols) ────────────────────────────── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Native Google Maps Dark Viewport Frame */}
          <div className="relative border border-white/10 rounded-2xl overflow-hidden shadow-2xl bg-zinc-950/90 h-[430px] w-full">
            <MapView
              userLocation={currentLocation}
              center={origin ?? undefined}
              markers={mapMarkers}
              activeRoute={routeItem}
              interactive
              options={{ styles: darkMapStyle }}
              styles={darkMapStyle}
              className="h-full w-full"
            />

            {/* Map Overlay Controls: Floating dark glass status pills sitting on map */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
              <div className="bg-zinc-950/80 border border-white/10 text-xs text-zinc-300 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="font-semibold text-zinc-200">Responder Position</span>
                <span className="font-mono text-[10px] text-zinc-400">
                  {vehicleInfo?.registrationNumber || 'RJ-14-EA-1001'}
                </span>
              </div>

              {destination && (
                <div className="bg-zinc-950/80 border border-white/10 text-xs text-zinc-300 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <span className="font-semibold text-rose-300">Incident Target</span>
                  <span className="font-mono text-[10px] text-rose-400">
                    {activeRequest.data?.situationType || 'Emergency'}
                  </span>
                </div>
              )}

              {routeItem && (
                <div className="bg-zinc-950/80 border border-white/10 text-xs text-zinc-300 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-rose-400" />
                  <span className="font-semibold text-zinc-200">ETA:</span>
                  <span className="font-mono text-[11px] font-bold text-rose-300">{routeItem.duration}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono text-[10px] text-zinc-400">{routeItem.distance}</span>
                </div>
              )}
            </div>

            {/* Bottom Dark Map Tag */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-zinc-950/80 border border-white/10 backdrop-blur-md p-1 rounded-xl shadow-xl">
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 border border-rose-500/30 rounded-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                Native Dark Mode Radar
              </span>
            </div>
          </div>

          {/* Today's Activity & Trip Summary Grid */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Today's Activity */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Today's Shift Activity</h3>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition"
                  onClick={() => navigate(ROUTES.DRIVER.TRIPS)}
                >
                  View All Log
                </button>
              </div>

              <div className="space-y-3">
                {todayTrips.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">No completed trips recorded today</p>
                ) : (
                  todayTrips.slice(0, 3).map((trip) => (
                    <div key={trip.id} className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            trip.status === 'COMPLETED'
                              ? 'bg-emerald-400'
                              : trip.status === 'CANCELLED'
                              ? 'bg-rose-400'
                              : 'bg-blue-400 animate-pulse'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate font-mono">
                            TRIP #{trip.id.slice(-6).toUpperCase()}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            {trip.createdAt
                              ? new Date(trip.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          trip.status === 'COMPLETED'
                            ? 'pill-active'
                            : trip.status === 'CANCELLED'
                            ? 'pill-critical'
                            : 'pill-info'
                        }`}
                      >
                        {trip.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Trip Performance Summary */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Shift Performance</h3>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>100% Verified</span>
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Completed Dispatches</span>
                  <span className="font-mono font-bold text-white text-sm">{completedTrips.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Ongoing Active Trip</span>
                  <span className="font-mono font-bold text-rose-300 text-sm">{activeTrip ? 1 : 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Cancelled / Aborted</span>
                  <span className="font-mono font-bold text-zinc-500 text-sm">{cancelledTrips.length}</span>
                </div>
                <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Estimated Mission Transit</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">Nominal (Sub-7m)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Current Assignment + Quick Actions + Nearby (2 cols) ─ */}
        <div className="lg:col-span-2 space-y-6">

          {/* Current Assignment Panel: Spacious Dark Glass Panel */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Current Assignment</h3>
              {activeTrip && (
                <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-black">
                  CRITICAL EMERGENCY
                </span>
              )}
            </div>

            {activeTrip && activeRequest.data ? (
              <div className="space-y-4">
                {/* Patient Triage Info */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase font-mono">Patient Status</p>
                    <p className="text-xs font-bold text-white mt-0.5">{activeRequest.data.situationType}</p>
                  </div>
                </div>

                {/* Estimated Arrival in JetBrains Mono font */}
                {activeRequest.data.etaMinutes && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-rose-400" />
                      <span className="text-xs text-rose-300 font-semibold">Estimated Arrival</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-white">
                      {activeRequest.data.etaMinutes} MINS
                    </span>
                  </div>
                )}

                {/* Step-by-Step Routing: Step 1 Pickup Location */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                      <p className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Step 1: Patient Pickup</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.location.assign('tel:112')}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white transition"
                      title="Call"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-zinc-200">
                    {activeRequest.data.location || 'Dispatch Coordinates Recorded'}
                  </p>
                </div>

                {/* Step-by-Step Routing: Step 2 Destination Hospital */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <p className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Step 2: Destination Trauma Center</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.location.assign('tel:112')}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white transition"
                      title="Call Hospital"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-zinc-200">
                    {activeRequest.data.hospitalName || 'Designated District Hospital'}
                  </p>
                </div>

                {/* High-Contrast Action Triggers */}
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.DRIVER.NAVIGATION('active'))}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs shadow-xl shadow-rose-950/60 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Navigation className="h-4 w-4" />
                  <span>Navigate with Native Maps</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(ROUTES.DRIVER.TRIPS)}
                  className="w-full text-center text-xs font-semibold text-zinc-400 hover:text-white py-1 transition"
                >
                  Update Trip Milestones →
                </button>
              </div>
            ) : (
              <div className="py-10 text-center text-zinc-400 space-y-2">
                <Navigation className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
                <p className="text-xs font-semibold text-zinc-300">No Active Mission Assignment</p>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  {isOnDuty
                    ? 'Standing by on live GPS radar. Central routing engine will trigger urgent job offers.'
                    : 'Turn duty state to "Go Online" to receive incoming patient dispatches.'}
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions Responder Bento */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Rapid Responder Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/5 transition cursor-pointer"
                onClick={() => window.location.assign('tel:112')}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-200 text-center leading-tight">Emergency<br />Alert</span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition cursor-pointer"
                onClick={() => window.location.assign('tel:112')}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Phone className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-200 text-center leading-tight">Call Control<br />Center</span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-purple-500/30 hover:bg-purple-500/5 transition cursor-pointer"
                onClick={() => navigate(ROUTES.DRIVER.NOTIFICATIONS)}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <MessageSquare className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-200 text-center leading-tight">Message<br />Dispatch</span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition cursor-pointer"
                onClick={() => {
                  if (navigator.share && location) {
                    void navigator.share({
                      title: 'ResQ Ambulance Location',
                      text: `Ambulance responder coordinates: ${location.latitude}, ${location.longitude}`,
                      url: `https://maps.google.com/?q=${location.latitude},${location.longitude}`,
                    });
                  }
                }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Share2 className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-200 text-center leading-tight">Share GPS<br />Telemetry</span>
              </button>
            </div>
          </div>

          {/* Available Requests Nearby Panel */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Nearby Urgent Calls</h3>
              <button
                type="button"
                className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition"
                onClick={() => navigate(ROUTES.DRIVER.ASSIGNMENTS)}
              >
                View All
              </button>
            </div>

            {availableRequests.length === 0 ? (
              <div className="text-center py-6 text-zinc-400">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400/80 mb-2" />
                <p className="text-xs font-semibold text-zinc-300">All Nearby Incidents Assigned</p>
                <p className="text-[10px] text-zinc-500 mt-1">Standby units listening on channel 1</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableRequests.map((req) => {
                  const badge = priorityBadge(req.situationType);
                  return (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">{req.requestCode}</span>
                      </div>
                      <p className="text-xs font-bold text-white leading-snug">{req.situationType}</p>
                      <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                        <span className="truncate">{req.location || 'Jaipur grid'}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.DRIVER.ASSIGNMENT_DETAIL(req.id))}
                        className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 shadow-md shadow-rose-950/60 transition cursor-pointer"
                      >
                        <span>Accept Emergency</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shift Schedule Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Duty Schedule</h3>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-rose-400" />
                <div>
                  <p className="text-xs font-bold text-white">Current Shift</p>
                  <p className="text-[10px] font-mono text-zinc-400">
                    {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  isOnDuty ? 'pill-active' : 'pill-neutral'
                }`}
              >
                {isOnDuty ? 'Active Roster' : 'Standby'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
