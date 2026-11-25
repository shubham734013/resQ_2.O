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
  TrendingUp,
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

const JAIPUR_DEMO_BASE = {
  latitude: 26.8950,
  longitude: 75.8020,
  accuracy: 10,
};

const isWithinDemoArea = (lat: number, lng: number) =>
  Math.abs(lat - JAIPUR_DEMO_BASE.latitude) < 0.9 && Math.abs(lng - JAIPUR_DEMO_BASE.longitude) < 0.9;

type CoordinatesFix = {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
};

const geolocationErrorMessage = (error: GeolocationPositionError) => {
  if (error.code === error.PERMISSION_DENIED)
    return 'Location access was not allowed. Using Jaipur Station for now.';
  if (error.code === error.POSITION_UNAVAILABLE)
    return 'Your device could not find your location. Using Jaipur Station for now.';
  return 'Could not get your location in time. Using Jaipur Station for now.';
};

const getCurrentGpsFix = (): Promise<CoordinatesFix> =>
  new Promise<CoordinatesFix>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ coords: JAIPUR_DEMO_BASE, timestamp: Date.now() });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (isWithinDemoArea(lat, lng)) {
          resolve({
            coords: { latitude: lat, longitude: lng, accuracy: pos.coords.accuracy || 10 },
            timestamp: pos.timestamp || Date.now(),
          });
        } else {
          resolve({ coords: JAIPUR_DEMO_BASE, timestamp: Date.now() });
        }
      },
      () => {
        resolve({ coords: JAIPUR_DEMO_BASE, timestamp: Date.now() });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 6000,
      },
    );
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
        setLocationError('Could not get your location to start duty.');
      }
    }
  };

  // Background GPS Telemetry Loop
  const locationRequestInFlightRef = useRef(false);
  const lastGpsSentAtRef = useRef(0);

  const syncBaseGpsMutation = useMutation({
    mutationFn: () =>
      ambulanceDriverApi.updateLocation({
        latitude: JAIPUR_DEMO_BASE.latitude,
        longitude: JAIPUR_DEMO_BASE.longitude,
        accuracy: JAIPUR_DEMO_BASE.accuracy,
        timestamp: Date.now(),
      }),
    onSuccess: async () => {
      setLocationError('');
      await invalidate();
    },
  });

  useEffect(() => {
    const dutyStatus = status.data?.status;
    if (dutyStatus !== 'ONLINE' && dutyStatus !== 'BUSY') {
      return;
    }
    const intervalMs = Math.max(3000, status.data?.trackingIntervalMs ?? 5000);
    let disposed = false;
    const requestFix = () => {
      if (disposed || locationRequestInFlightRef.current) return;
      locationRequestInFlightRef.current = true;
      const sendCoords = (coords: { latitude: number; longitude: number; accuracy: number }, ts: number) => {
        lastGpsSentAtRef.current = Date.now();
        void ambulanceDriverApi
          .updateLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            timestamp: ts,
          })
          .then(() => {
            setLocationError('');
          })
          .catch((error) => {
            setLocationError(error instanceof Error ? error.message : 'Location update failed.');
          })
          .finally(() => {
            locationRequestInFlightRef.current = false;
          });
      };

      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        sendCoords(JAIPUR_DEMO_BASE, Date.now());
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (disposed) {
            locationRequestInFlightRef.current = false;
            return;
          }
          setGpsPermissionDenied(false);
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (isWithinDemoArea(lat, lng)) {
            sendCoords({ latitude: lat, longitude: lng, accuracy: position.coords.accuracy || 10 }, position.timestamp || Date.now());
          } else {
            sendCoords(JAIPUR_DEMO_BASE, Date.now());
          }
        },
        () => {
          if (disposed) {
            locationRequestInFlightRef.current = false;
            return;
          }
          sendCoords(JAIPUR_DEMO_BASE, Date.now());
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 },
      );
    };
    const timer = window.setInterval(requestFix, intervalMs);
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
      return { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30', label: 'Critical' };
    if (/breathing|burn/.test(s))
      return { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', label: 'High' };
    return { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30', label: 'Normal' };
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
                  New emergency request
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {incomingOffer.request?.situationType || 'Emergency'}
                </h3>
                <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-400" />
                  <span>{incomingOffer.request?.pickup?.label || incomingOffer.hospital?.name || 'Location shared'}</span>
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
                Accept and go
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
            <span>Location is off. Turn it on to share your location and get requests.</span>
          </div>
          <button
            type="button"
            onClick={refreshLocation}
            className="px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 transition text-xs font-semibold cursor-pointer self-start sm:self-auto"
          >
            Refresh location
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
              <span>Ambulance driver home</span>
            </div>
            {/* Header Typography: Clean font structure with high line-height */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white leading-tight tracking-tight">
              Be the difference <br />
              <span className="font-bold bg-gradient-to-r from-rose-400 via-rose-300 to-amber-300 bg-clip-text text-transparent">
                in someone's life.
              </span>
            </h1>
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
                <span>Open current trip</span>
              </button>
            ) : status.data?.status === 'ONLINE' || status.data?.status === 'BUSY' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncBaseGpsMutation.mutate()}
                  disabled={syncBaseGpsMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 border border-white/10 transition-all cursor-pointer disabled:opacity-50"
                  title="Refresh ambulance location"
                >
                  <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{syncBaseGpsMutation.isPending ? 'Updating…' : 'Update location'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => endDutyMutation.mutate()}
                  disabled={!status.data?.canEndDuty || endDutyMutation.isPending}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 shadow-lg shadow-rose-950/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Radio className="h-4 w-4 text-rose-400" />
                  <span>{endDutyMutation.isPending ? 'Ending shift…' : 'Go off duty'}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void startDuty()}
                disabled={!status.data?.canStartDuty || startDutyMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 shadow-lg shadow-emerald-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>{startDutyMutation.isPending ? 'Getting location…' : 'Go on duty'}</span>
              </button>
            )}

            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <span className={`h-2 w-2 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span>{isOnDuty ? 'Ready for requests' : 'Off duty'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4 Spacious Bento Metric Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Card 1: Current Status */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Work status</span>
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
            {isOnDuty ? '● On duty' : '○ Off duty'}
          </p>
          <p className="text-[11px] text-zinc-400 leading-snug">
            {isOnDuty ? 'Ready for emergency requests' : 'Not taking requests'}
          </p>
        </div>

        {/* Card 2: Active Request */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Current request</span>
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
            {activeTrip ? activeTrip.status === 'AT_PICKUP' ? 'At pickup' : activeTrip.status === 'AT_HOSPITAL' ? 'At hospital' : 'On the way' : 'No current trip'}
          </p>
        </div>

        {/* Card 3: Today's Trips */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Trips today</span>
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
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Shift status</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="font-mono text-xl font-light text-zinc-100 tracking-tight">
            {isOnDuty ? 'On duty' : 'Off duty'}
          </p>
          <p className="font-mono text-[11px] text-zinc-400 leading-snug">
            {status.data?.updatedAt
              ? `Since ${new Date(status.data.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Shift started'}
          </p>
        </div>
      </div>

      {locationError && (
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          {locationError}
        </p>
      )}

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
                <span className="font-semibold text-zinc-200">Ambulance</span>
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
                  <span className="font-semibold text-rose-300">Request location</span>
                  <span className="font-mono text-[10px] text-rose-400">
                    {activeRequest.data?.situationType || 'Emergency'}
                  </span>
                </div>
              )}

              {routeItem && (
                <div className="bg-zinc-950/80 border border-white/10 text-xs text-zinc-300 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-rose-400" />
                  <span className="font-semibold text-zinc-200">Time left:</span>
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
                Live map
              </span>
            </div>
          </div>

          {/* Today's Activity & Trip Summary Grid */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Today's Activity */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Trips today</h3>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition"
                  onClick={() => navigate(ROUTES.DRIVER.TRIPS)}
                >
                  View trips
                </button>
              </div>

              <div className="space-y-3">
                {todayTrips.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">No trips finished today.</p>
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
                        {trip.status === 'COMPLETED' ? 'Done' : trip.status === 'CANCELLED' ? 'Cancelled' : 'In progress'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Trip Performance Summary */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Trip summary</h3>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Today</span>
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Trips finished</span>
                  <span className="font-mono font-bold text-white text-sm">{completedTrips.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Current trip</span>
                  <span className="font-mono font-bold text-rose-300 text-sm">{activeTrip ? 1 : 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Trips cancelled</span>
                  <span className="font-mono font-bold text-zinc-500 text-sm">{cancelledTrips.length}</span>
                </div>
                <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Travel time</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">See map</span>
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
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Current trip</h3>
              {activeTrip && (
                <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-black">
                  Emergency
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
                    <p className="text-[10px] text-zinc-400 uppercase font-mono">Emergency type</p>
                    <p className="text-xs font-bold text-white mt-0.5">{activeRequest.data.situationType}</p>
                  </div>
                </div>

                {/* Estimated Arrival in JetBrains Mono font */}
                {activeRequest.data.etaMinutes && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-rose-400" />
                      <span className="text-xs text-rose-300 font-semibold">Time to arrival</span>
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
                      <p className="text-[10px] font-mono uppercase text-zinc-400 font-bold">1. Pick up patient</p>
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
                    {activeRequest.data.location || 'Pickup location shared'}
                  </p>
                </div>

                {/* Step-by-Step Routing: Step 2 Destination Hospital */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <p className="text-[10px] font-mono uppercase text-zinc-400 font-bold">2. Go to hospital</p>
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
                    {activeRequest.data.hospitalName || 'Hospital'}
                  </p>
                </div>

                {/* High-Contrast Action Triggers */}
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.DRIVER.NAVIGATION('active'))}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs shadow-xl shadow-rose-950/60 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Navigation className="h-4 w-4" />
                  <span>Open directions</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(ROUTES.DRIVER.TRIPS)}
                  className="w-full text-center text-xs font-semibold text-zinc-400 hover:text-white py-1 transition"
                >
                  Update trip status →
                </button>
              </div>
            ) : (
              <div className="py-10 text-center text-zinc-400 space-y-2">
                <Navigation className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
                <p className="text-xs font-semibold text-zinc-300">No current trip</p>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  {isOnDuty
                    ? 'Waiting for an emergency request.'
                    : 'Go on duty to get emergency requests.'}
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions Responder Bento */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Quick actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/5 transition cursor-pointer"
                onClick={() => window.location.assign('tel:112')}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-200 text-center leading-tight">Call for<br />emergency help</span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition cursor-pointer"
                onClick={() => window.location.assign('tel:112')}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Phone className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-200 text-center leading-tight">Call help<br />line</span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-purple-500/30 hover:bg-purple-500/5 transition cursor-pointer"
                onClick={() => navigate(ROUTES.DRIVER.NOTIFICATIONS)}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <MessageSquare className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-200 text-center leading-tight">Message<br />dispatch</span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition cursor-pointer"
                onClick={() => {
                  if (navigator.share && location) {
                    void navigator.share({
                      title: 'Ambulance location',
                      text: `Ambulance location: ${location.latitude}, ${location.longitude}`,
                      url: `https://maps.google.com/?q=${location.latitude},${location.longitude}`,
                    });
                  }
                }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Share2 className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-200 text-center leading-tight">Share<br />location</span>
              </button>
            </div>
          </div>

          {/* Available Requests Nearby Panel */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Nearby requests</h3>
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
                <p className="text-xs font-semibold text-zinc-300">No nearby requests</p>
                <p className="text-[10px] text-zinc-500 mt-1">Wait for a new request.</p>
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
                        <span>View request</span>
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
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Shift</h3>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-rose-400" />
                <div>
                  <p className="text-xs font-bold text-white">Today</p>
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
                {isOnDuty ? 'On duty' : 'Off duty'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
