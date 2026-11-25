import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Hospital,
  RefreshCw,
  MapPin,
  Wifi,
  WifiOff,
  ShieldCheck,
  Radio,
  Power,
  Navigation,
  AlertTriangle,
  Phone,
  Compass,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AmbulanceStatus } from '../components/ambulance/AmbulanceStatus';
import { AmbulanceLayout } from '../components/ambulance/AmbulanceLayout';
import { NavigationPanel } from '../components/ambulance/NavigationPanel';
import { MapView, darkMapStyle } from '../components/map/MapView';
import { ambulanceDriverApi } from '../services/ambulanceDriverApi';
import { useAmbulanceRoute } from '../hooks/useAmbulanceRoute';
import { trackingApi, trackingRouteOption } from '../services/trackingApi';
import { useLocationState } from '../hooks/useLocationState';
import type { UserLocation } from '../types/facility';
import type { RouteOptionItem } from '../types/route';

interface LayoutContext {
  currentLocation: UserLocation;
  location: { latitude: number; longitude: number; accuracyMeters?: number; timestamp: number } | null;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported' | 'unknown';
  refreshLocation: () => void;
  isUpdating: boolean;
}

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
      { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 }
    );
  });

const navigationFor = (route: RouteOptionItem) => ({
  instruction: route.instructions[0]?.instruction ?? 'Follow the highlighted route',
  eta: route.duration,
  distance: route.distance,
  currentStepIndex: 0,
});

/* ─── Dark Obsidian Dispatch Countdown Card ────────────────────────────── */
const DispatchCountdownCard = ({
  offer,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: {
  offer: import('../services/ambulanceDriverApi').DispatchOffer;
  onAccept: () => void;
  onReject: () => void;
  isAccepting: boolean;
  isRejecting: boolean;
}) => {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = now === 0 ? 25 : Math.max(0, Math.ceil((new Date(offer.deadlineAt).getTime() - now) / 1000));
  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / 25) * 100));
  const request = offer.request;
  const hospital = offer.hospital;
  const expired = secondsLeft <= 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 font-sans">
      <div className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header & Timer Badge */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono mb-1.5">
              <Radio className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
              <span>Urgent help request</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight">Emergency help offer</h1>
          </div>

          <div
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold font-mono shrink-0 ${
              expired
                ? 'border-white/10 bg-white/[0.04] text-zinc-500'
                : secondsLeft <= 8
                ? 'border-rose-500/40 bg-rose-500/20 text-rose-300 animate-pulse'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>{expired ? 'Time is up' : `${secondsLeft}s left`}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full transition-all duration-300 ${
              secondsLeft <= 6 ? 'bg-rose-500' : secondsLeft <= 12 ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Details Grid */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3.5">
            <div>
              <p className="text-[11px] font-mono text-zinc-400 uppercase">Request ID</p>
              <p className="font-mono text-base font-semibold text-rose-300 mt-0.5">
                {request?.requestCode ?? offer.dispatchJobId}
              </p>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                <AlertTriangle className="h-3.5 w-3.5" />
                {request?.situationType ?? request?.category ?? 'Emergency'}
              </span>
            </div>
          </div>

          {/* Patient Pickup Location */}
          <div className="border-b border-white/5 pb-3.5">
            <p className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-rose-400" />
              Patient pickup location
            </p>
            <p className="font-medium text-zinc-100 text-sm mt-1">{request?.pickup.label || 'Emergency location'}</p>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {request?.pickup.latitude.toFixed(5)}, {request?.pickup.longitude.toFixed(5)}
            </p>
          </div>

          {/* Destination Hospital */}
          <div className="border-b border-white/5 pb-3.5">
            <p className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
              <Hospital className="h-3.5 w-3.5 text-emerald-400" />
              Assigned hospital
            </p>
            <p className="font-medium text-zinc-100 text-sm mt-1">{hospital?.name ?? 'Hospital information available'}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{[hospital?.address, hospital?.city].filter(Boolean).join(', ')}</p>
            {hospital?.phone && (
              <a
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 hover:text-rose-300"
                href={`tel:${hospital.phone.replace(/[^0-9+]/g, '')}`}
              >
                <Phone className="h-3 w-3" />
                <span>Call hospital: {hospital.phone}</span>
              </a>
            )}
          </div>

          {/* Route to Pickup info */}
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
            <p className="text-[11px] font-mono uppercase text-zinc-400">Route to patient</p>
            <p className="mt-1 text-xs font-mono text-zinc-200">
              {offer.route?.source === 'DRIVING' && typeof offer.route.etaSeconds === 'number'
                ? `Arrives in about ${Math.max(1, Math.round(offer.route.etaSeconds / 60))} min · ${(offer.route.distanceMeters / 1000).toFixed(1)} km by road`
                : 'Route to the emergency is ready.'}
            </p>
          </div>
        </div>

        {expired && (
          <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
            This offer has expired. Check for the next emergency offer.
          </p>
        )}

        {/* Action Controls */}
        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={isAccepting || isRejecting || expired}
            className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-xl shadow-rose-950/70 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Navigation className="h-4 w-4" />
            <span>{isAccepting ? 'Accepting…' : 'Accept and go'}</span>
          </button>

          <button
            type="button"
            onClick={onReject}
            disabled={isRejecting || isAccepting || expired}
            className="py-3.5 px-6 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 font-semibold text-sm transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isRejecting ? 'Declining…' : 'Decline Offer'}
          </button>
        </div>

        <p className="text-center text-[10px] text-zinc-500 font-mono">
          The system sets the time limit. If you accept, live patient location updates start automatically.
        </p>
      </div>
    </div>
  );
};

export interface AmbulancePageProps {
  mode?: 'navigation' | 'request' | 'trips' | 'trip' | 'profile' | 'dashboard';
}

export const AmbulancePage = ({ mode }: AmbulancePageProps = {}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const outletContext = useOutletContext<LayoutContext | undefined>();
  const fallbackLocationState = useLocationState();
  const currentLocation = outletContext?.currentLocation ?? fallbackLocationState.currentLocation;
  const location = outletContext?.location ?? fallbackLocationState.location;
  const permissionState = outletContext?.permissionState ?? fallbackLocationState.permissionState;
  const refreshLocation = outletContext?.refreshLocation ?? fallbackLocationState.refreshLocation;
  const isDriverNamespace = pathname.startsWith('/driver');
  const basePrefix = isDriverNamespace ? '/driver' : '/ambulance';

  const routeMode =
    mode ??
    pathname
      .replace('/driver/assignments', 'request')
      .replace('/driver/navigation', 'navigation')
      .replace('/driver/trips', 'trips')
      .replace('/driver/trip', 'trip')
      .replace('/driver/profile', 'profile')
      .replace('/driver/dashboard', '')
      .replace('/driver', '')
      .replace('/ambulance', '')
      .replace(/^\//, '');

  const profile = useQuery({ queryKey: ['ambulance-driver', 'profile'], queryFn: ambulanceDriverApi.getProfile });
  const status = useQuery({
    queryKey: ['ambulance-driver', 'status'],
    queryFn: ambulanceDriverApi.getStatus,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const requests = useQuery({ queryKey: ['ambulance-driver', 'requests'], queryFn: () => ambulanceDriverApi.getRequests({ limit: 20 }) });
  const offers = useQuery({
    queryKey: ['ambulance-driver', 'dispatch-offers'],
    queryFn: ambulanceDriverApi.getDispatchOffers,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });
  const trips = useQuery({ queryKey: ['ambulance-driver', 'trips'], queryFn: () => ambulanceDriverApi.getTrips({ limit: 20 }) });
  const activeTrip = useMemo(
    () => trips.data?.items.find((t) => !['COMPLETED', 'CANCELLED'].includes(t.status)) ?? null,
    [trips.data?.items]
  );
  const [locationHealth, setLocationHealth] = useState<'PAUSED' | 'TRACKING' | 'RETRYING' | 'ERROR'>('PAUSED');
  const [locationError, setLocationError] = useState('');
  const [lastLocationSentAt, setLastLocationSentAt] = useState<number | null>(null);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
  const [trackingRestartToken, setTrackingRestartToken] = useState(0);
  const lastGpsSentAtRef = useRef(0);
  const locationRequestInFlightRef = useRef(false);
  const [pickupOtpInput, setPickupOtpInput] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Patient unconscious or unresponsive');
  const [pickupVerificationError, setPickupVerificationError] = useState<string | null>(null);

  const activeRequest = useQuery({
    queryKey: ['ambulance-driver', 'request', activeTrip?.emergencyRequestId],
    queryFn: () => ambulanceDriverApi.getRequest(activeTrip!.emergencyRequestId),
    enabled: Boolean(activeTrip?.emergencyRequestId),
  });

  const incoming =
    requests.data?.items.find((r) => !r.driverId && ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(r.status)) ??
    requests.data?.items[0] ??
    null;
  const incomingOffer = offers.data?.[0] ?? null;
  const selectedRequest = routeMode === 'request' ? incoming : activeRequest.data ?? incoming;
  const destination = useMemo(
    () =>
      selectedRequest && typeof selectedRequest.latitude === 'number' && typeof selectedRequest.longitude === 'number'
        ? { latitude: selectedRequest.latitude, longitude: selectedRequest.longitude }
        : null,
    [selectedRequest]
  );
  const origin = useMemo(() => (location ? { latitude: location.latitude, longitude: location.longitude } : null), [location]);
  const toHospital = activeTrip?.status === 'PATIENT_ONBOARD' || activeTrip?.status === 'TO_HOSPITAL' || activeTrip?.status === 'AT_HOSPITAL';
  const hospitalLat = activeRequest.data?.hospitalLatitude;
  const hospitalLng = activeRequest.data?.hospitalLongitude;
  const routeDestination = useMemo(
    () =>
      toHospital
        ? typeof hospitalLat === 'number' && typeof hospitalLng === 'number'
          ? { latitude: hospitalLat, longitude: hospitalLng }
          : destination
        : destination,
    [toHospital, hospitalLat, hospitalLng, destination]
  );
  const route = useAmbulanceRoute(origin, destination, !activeTrip);
  const liveRoute = useQuery({
    queryKey: ['ambulance-driver', 'live-route', activeTrip?.id, toHospital ? 'HOSPITAL' : 'PICKUP', origin?.latitude.toFixed(3), origin?.longitude.toFixed(3)],
    queryFn: () => trackingApi.getRoute(activeTrip!.id),
    enabled: Boolean(activeTrip && routeDestination && status.data?.location?.coordinatesAreLive && !['AT_HOSPITAL', 'COMPLETED', 'CANCELLED'].includes(activeTrip.status)),
    staleTime: 18000,
    refetchInterval:
      activeTrip && routeDestination && status.data?.location?.coordinatesAreLive && !['AT_HOSPITAL', 'COMPLETED', 'CANCELLED'].includes(activeTrip.status)
        ? 20000
        : false,
    retry: 1,
  });
  const routeItem = activeTrip
    ? activeTrip.status === 'AT_HOSPITAL' || liveRoute.isError
      ? null
      : liveRoute.data?.routes[0]
      ? trackingRouteOption(liveRoute.data.routes[0])
      : null
    : route.routes[0] ?? null;

  const mapMarkers = useMemo(() => {
    const list = [];
    if (destination) {
      list.push({
        id: 'pickup',
        latitude: destination.latitude,
        longitude: destination.longitude,
        title: selectedRequest?.location || 'Patient Pickup',
        subtitle: 'Pickup Coordinates',
        isEmergency: true,
      });
    }
    if (routeDestination && toHospital) {
      list.push({
        id: 'hospital',
        type: 'HOSPITAL' as const,
        latitude: routeDestination.latitude,
        longitude: routeDestination.longitude,
        title: activeRequest.data?.hospitalName || 'Hospital',
        subtitle: 'Emergency Intake',
        isEmergency: true,
      });
    }
    return list;
  }, [destination, routeDestination, toHospital, selectedRequest?.location, activeRequest.data?.hospitalName]);

  const invalidate = useCallback(() => Promise.all([qc.invalidateQueries({ queryKey: ['ambulance-driver'] })]), [qc]);

  const startDutyMutation = useMutation({
    mutationFn: (fix: { latitude: number; longitude: number; accuracy: number; timestamp: number }) => ambulanceDriverApi.startDuty(fix),
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
      if (error && typeof error === 'object' && 'code' in error && (error as GeolocationPositionError).code === 1) setGpsPermissionDenied(true);
      setLocationHealth('ERROR');
      setLocationError(error instanceof Error ? error.message : 'Could not start duty. Check location access and try again.');
    }
  };

  useEffect(() => {
    const dutyStatus = status.data?.status;
    let disposed = false;
    if (dutyStatus !== 'ONLINE' && dutyStatus !== 'BUSY') return;
    const intervalMs = Math.min(5000, Math.max(3000, status.data?.trackingIntervalMs ?? 4000));
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
            setLastLocationSentAt(Date.now());
            setLocationError('');
            setLocationHealth('TRACKING');
          })
          .catch((error) => {
            setLocationError(error instanceof Error ? error.message : 'Could not update location. ResQ will try again.');
            setLocationHealth('RETRYING');
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
        { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 }
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

  const acceptOffer = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.acceptDispatchOffer(id),
    onSuccess: async () => {
      await invalidate();
      await qc.invalidateQueries({ queryKey: ['ambulance-driver', 'dispatch-offers'] });
      navigate(`${basePrefix}/navigation`);
    },
  });

  const rejectOffer = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.rejectDispatchOffer(id),
    onSuccess: async () => {
      await invalidate();
      await qc.invalidateQueries({ queryKey: ['ambulance-driver', 'dispatch-offers'] });
      navigate(basePrefix);
    },
  });

  const pickup = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.arrivedPickup(id),
    onSuccess: async () => {
      await invalidate();
      navigate(`${basePrefix}/trips`);
    },
  });

  const onboard = useMutation({
    mutationFn: (payload: { id: string; otp?: string; overrideReason?: string } | string) => {
      const tripId = typeof payload === 'string' ? payload : payload.id;
      const body = typeof payload === 'string' ? undefined : { otp: payload.otp, overrideReason: payload.overrideReason };
      return ambulanceDriverApi.patientPickedUp(tripId, body);
    },
    onSuccess: async () => {
      await invalidate();
      navigate(`${basePrefix}/navigation`);
    },
    onError: (err: unknown) => {
      setPickupVerificationError(err instanceof Error ? err.message : 'Could not check the pickup code.');
    },
  });

  const hospital = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.arrivedHospital(id),
    onSuccess: async () => {
      await invalidate();
      navigate(`${basePrefix}/trips`);
    },
  });

  const complete = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.completeTrip(id),
    onSuccess: async () => {
      await invalidate();
      navigate(`${basePrefix}/trips`);
    },
  });
  const actionMutationError = toHospital ? hospital.error : pickup.error;
  const actionError = actionMutationError
    ? actionMutationError instanceof Error
      ? actionMutationError.message
      : 'Could not update the trip. Please try again.'
    : null;

  /* ── 1. Active Request Mode (/driver/assignments) ─────────────────────── */
  if (routeMode === 'request') {
    return (
      <AmbulanceLayout>
        {incomingOffer ? (
          <DispatchCountdownCard
            offer={incomingOffer}
            onAccept={() => acceptOffer.mutate(incomingOffer.dispatchJobId)}
            onReject={() => rejectOffer.mutate(incomingOffer.dispatchJobId)}
            isAccepting={acceptOffer.isPending}
            isRejecting={rejectOffer.isPending}
          />
        ) : (
          <div className="mx-auto w-full max-w-2xl px-4 py-12 font-sans">
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-xl space-y-4">
              <div className="bg-rose-500/10 text-rose-400 p-5 rounded-2xl border border-rose-500/20 inline-flex items-center justify-center shadow-lg shadow-rose-950/40">
                <Radio className="h-7 w-7 animate-pulse" />
              </div>
              <h1 className="text-2xl font-light text-zinc-100 tracking-tight">No new offers</h1>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                New emergency offers show here as they come in. Stay on duty to get them.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => void offers.refetch()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 transition cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Check for offers</span>
                </button>
              </div>
              {offers.isError && (
                <p role="alert" className="mt-3 text-xs text-rose-400">
                  Could not load offers. Check your internet and try again.
                </p>
              )}
            </div>
          </div>
        )}
      </AmbulanceLayout>
    );
  }

  /* ── 2. Waiting for Route Navigation Mode ────────────────────────────── */
  if (routeMode === 'navigation' && activeTrip && routeDestination && !routeItem) {
    return (
      <AmbulanceLayout>
        <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-12 font-sans">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
              <Compass className="h-3.5 w-3.5 animate-spin" />
              <span>Finding a route</span>
            </div>
            <h1 className="text-2xl font-light text-zinc-100 tracking-tight">
              {activeTrip.status === 'AT_HOSPITAL'
                ? 'Patient reached the hospital'
                : toHospital
                ? 'Finding a route to the hospital…'
                : 'Finding a route to the patient…'}
            </h1>
            <p role="status" className="text-sm text-zinc-400 leading-relaxed">
              {activeTrip.status === 'AT_HOSPITAL'
                ? 'The patient reached the hospital emergency area. Finish the trip in Trip actions.'
                : status.data?.location?.freshness !== 'FRESH'
                ? 'Waiting for your live location. We will not use an old location for directions.'
                : liveRoute.isError
                ? 'We cannot find directions right now. Try again below.'
                : 'Finding directions…'}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => void liveRoute.refetch()}
                disabled={activeTrip.status === 'AT_HOSPITAL' || liveRoute.isFetching || !status.data?.location?.coordinatesAreLive}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try again</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/driver/trips')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-semibold transition cursor-pointer"
              >
                <span>Trip actions</span>
              </button>
            </div>
          </div>
        </div>
      </AmbulanceLayout>
    );
  }

  /* ── 3. Active Turn-by-Turn Navigation Mode ──────────────────────────── */
  if (routeMode === 'navigation' && activeTrip && routeItem && routeDestination) {
    return (
      <AmbulanceLayout>
        <NavigationPanel
          title={toHospital ? 'Going to hospital' : 'Going to patient'}
          destinationName={toHospital ? activeRequest.data?.hospitalName ?? 'Hospital' : selectedRequest?.location ?? 'Patient pickup'}
          destinationAddress={
            toHospital
              ? activeRequest.data?.hospitalName
                ? `${activeRequest.data.hospitalName} emergency area`
                : 'Hospital emergency area'
              : selectedRequest?.location ?? 'Pickup location'
          }
          destinationCoordinates={routeDestination}
          navigation={navigationFor(routeItem)}
          userLocation={currentLocation}
          route={routeItem}
          onAction={() => (toHospital ? hospital.mutate(activeTrip.id) : pickup.mutate(activeTrip.id))}
          actionLabel={toHospital ? 'At the hospital' : 'At pickup'}
          actionPending={toHospital ? hospital.isPending : pickup.isPending}
          actionError={actionError}
          onCall={profile.data?.phone ? () => window.location.assign('tel:' + profile.data.phone) : undefined}
        />
      </AmbulanceLayout>
    );
  }

  /* ── 4. Patient Arrival Confirmation Mode ────────────────────────────── */
  if (routeMode === 'trips' && activeTrip?.status === 'AT_PICKUP') {
    return (
      <AmbulanceLayout>
        <div className="mx-auto w-full max-w-2xl px-4 py-12 font-sans">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-950/40">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">At the pickup location</h1>
              <p className="text-sm text-zinc-400 mt-1.5">
                Use the patient's 6-digit code to confirm they are in the ambulance. If they cannot share the code, you may use the emergency override.
              </p>
            </div>

            {pickupVerificationError && (
              <div role="alert" className="p-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{pickupVerificationError}</span>
              </div>
            )}

            {!showOverride ? (
              <div className="space-y-4 bg-white/[0.02] border border-white/10 rounded-2xl p-5">
                <label htmlFor="pickup-otp" className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
                  Enter the 6-digit pickup code
                </label>
                <div className="relative">
                  <input
                    id="pickup-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pickupOtpInput}
                    onChange={(e) => {
                      setPickupVerificationError(null);
                      setPickupOtpInput(e.target.value.replace(/[^0-9]/g, ''));
                    }}
                    placeholder="e.g. 542109"
                    className="w-full h-14 rounded-xl bg-black/40 border border-white/15 px-4 font-mono text-2xl tracking-[0.3em] text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500/80 transition text-center"
                  />
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 pointer-events-none" />
                </div>
                <p className="text-xs text-zinc-400 font-light">
                  Ask the patient or their emergency contact for the 6-digit code to confirm pickup.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (pickupOtpInput.length !== 6) {
                      setPickupVerificationError('Enter all 6 digits.');
                      return;
                    }
                    setPickupVerificationError(null);
                    onboard.mutate({ id: activeTrip.id, otp: pickupOtpInput });
                  }}
                  disabled={onboard.isPending || pickupOtpInput.length !== 6}
                  className="flex items-center justify-center gap-2 w-full min-h-14 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold text-sm shadow-xl shadow-emerald-950/60 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
                >
                  <Navigation className="h-4 w-4" />
                  <span>{onboard.isPending ? 'Checking code…' : 'Check code and go to hospital'}</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setPickupVerificationError(null);
                      setShowOverride(true);
                    }}
                    className="text-xs text-amber-400/90 hover:text-amber-300 underline font-medium cursor-pointer"
                  >
                    Patient cannot share the code? Use emergency override
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 bg-amber-500/[0.04] border border-amber-500/30 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                        Emergency override
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPickupVerificationError(null);
                      setShowOverride(false);
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    Back to code
                  </button>
                </div>
                <p className="text-xs text-amber-200/80 font-light leading-relaxed">
                  Use this option if the patient cannot answer, is unconscious, or cannot give the code. This action and the medical reason will be saved in the record.
                </p>

                <div className="space-y-2">
                  <label htmlFor="override-reason" className="block text-[11px] font-mono uppercase text-zinc-400">
                    Reason for emergency override
                  </label>
                  <select
                    id="override-reason"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full h-11 rounded-xl bg-black/50 border border-amber-500/30 px-3 text-xs text-zinc-200 focus:outline-hidden"
                  >
                    <option value="Patient unconscious or unresponsive">Patient cannot wake or answer</option>
                    <option value="Severe trauma / Patient incapacitated">Very bad injury; patient cannot respond</option>
                    <option value="Acute stroke or speech deficit">Possible stroke or trouble speaking</option>
                    <option value="Pediatric emergency without guardian phone">Child needs help; no guardian phone</option>
                    <option value="Bystander rescue / Device inaccessible">A helper is rescuing them; their phone cannot be used</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPickupVerificationError(null);
                    onboard.mutate({ id: activeTrip.id, overrideReason });
                  }}
                  disabled={onboard.isPending}
                  className="flex items-center justify-center gap-2 w-full min-h-14 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-sm shadow-xl shadow-amber-950/60 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
                >
                  <Navigation className="h-4 w-4" />
                  <span>{onboard.isPending ? 'Saving…' : 'Use override and go to hospital'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </AmbulanceLayout>
    );
  }

  /* ── 5. Hospital Arrival Confirmation Mode ───────────────────────────── */
  if (routeMode === 'trips' && activeTrip?.status === 'AT_HOSPITAL') {
    return (
      <AmbulanceLayout>
        <div className="mx-auto w-full max-w-2xl px-4 py-12 font-sans">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-lg shadow-rose-950/40">
              <Hospital className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">At the hospital</h1>
              <p className="text-sm text-zinc-400 mt-1.5">
                Finish the trip after handing the patient to the hospital care team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => complete.mutate(activeTrip.id)}
              disabled={complete.isPending}
              className="flex items-center justify-center gap-2 w-full min-h-14 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-xl shadow-rose-950/60 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{complete.isPending ? 'Finishing trip…' : 'Confirm handover and finish trip'}</span>
            </button>
          </div>
        </div>
      </AmbulanceLayout>
    );
  }

  /* ── 6. Trip History & Active Log Mode (/driver/trips) ────────────────── */
  if (routeMode === 'trips') {
    return (
      <AmbulanceLayout>
        <div className="mx-auto w-full max-w-4xl px-4 py-8 font-sans space-y-6">
          {/* Header */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono mb-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Trip and activity record</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">Past trips and offers</h1>
            <p className="text-xs md:text-sm text-zinc-400 mt-1">
              A record of emergency trips and patient handovers.
            </p>
          </div>

          {/* Dark Glass Panel Container */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
            {(trips.data?.items ?? []).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-zinc-400">No emergency trips yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(trips.data?.items ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs px-3 py-1 rounded-full font-mono flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          {t.status === 'COMPLETED' ? 'Done' : t.status === 'CANCELLED' ? 'Cancelled' : t.status === 'AT_PICKUP' ? 'At pickup' : t.status === 'AT_HOSPITAL' ? 'At hospital' : 'In progress'}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">{new Date(t.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-mono text-zinc-400 pt-1">
                        Request ID: <span className="text-zinc-200">{t.emergencyRequestId}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-500">Trip number: {t.id.slice(-8)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AmbulanceLayout>
    );
  }

  /* ── 7. Default Navigation & Dispatch Command Center ──────────────────── */
  return (
    <AmbulanceLayout>
      <div className="flex flex-1 flex-col font-sans">
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono mb-2">
                <Radio className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                <span>Ambulance home</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">
                {profile.data?.fullName ?? 'Responder Rajesh Sharma'}
              </h1>
              <p className="text-xs text-zinc-400 mt-1">Live location and new emergency offers.</p>
            </div>
            <div>
              <AmbulanceStatus status={status.data?.status === 'ONLINE' ? 'available' : status.data?.status === 'BUSY' ? 'busy' : 'offline'} />
            </div>
          </div>

          {/* Uber-Style Tactile Duty Controller: Dark Glass Mesh Card */}
          <div className="bg-gradient-to-r from-rose-950/20 via-zinc-900/60 to-zinc-950/80 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
                    status.data?.status === 'ONLINE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-950/50'
                      : status.data?.status === 'BUSY'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-lg shadow-rose-950/50'
                      : 'bg-white/[0.03] text-zinc-400 border-white/10'
                  }`}
                >
                  {status.data?.status === 'ONLINE' ? (
                    <>
                      <Radio className="h-7 w-7 animate-pulse" />
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                    </>
                  ) : status.data?.status === 'BUSY' ? (
                    <Navigation className="h-7 w-7 animate-bounce" />
                  ) : (
                    <Power className="h-7 w-7" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Duty status</span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold ${
                        status.data?.status === 'ONLINE'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : status.data?.status === 'BUSY'
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          : 'bg-white/[0.04] text-zinc-400 border border-white/10'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          status.data?.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : status.data?.status === 'BUSY' ? 'bg-rose-400' : 'bg-zinc-500'
                        }`}
                      />
                      {status.data?.status === 'ONLINE' ? 'On duty · Ready for offers' : status.data?.status === 'BUSY' ? 'On a trip' : 'Off duty'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 leading-snug">
                    {status.data?.status === 'ONLINE' && status.data?.location?.freshness === 'FRESH'
                      ? 'Live location is on. Ready for offers.'
                      : status.data?.status === 'ONLINE'
                      ? 'On duty · Waiting for live location'
                      : status.data?.status === 'BUSY'
                      ? 'On an emergency trip.'
                      : 'Go on duty to get emergency offers.'}
                  </p>
                </div>
              </div>

              {/* Duty Controls */}
              <div className="flex items-center gap-3">
                {status.data?.status === 'BUSY' && status.data.activeTrip ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(activeTrip?.status === 'AT_PICKUP' || activeTrip?.status === 'AT_HOSPITAL' ? `${basePrefix}/trips` : `${basePrefix}/navigation`)
                    }
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-950/60 transition cursor-pointer"
                  >
                    <Navigation className="h-4 w-4" />
                    <span>Continue trip</span>
                  </button>
                ) : status.data?.status === 'ONLINE' || status.data?.status === 'BUSY' ? (
                  <button
                    type="button"
                    onClick={() => endDutyMutation.mutate()}
                    disabled={!status.data?.canEndDuty || endDutyMutation.isPending}
                    className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 transition cursor-pointer disabled:opacity-50"
                  >
                    {endDutyMutation.isPending ? 'Ending duty…' : 'Go off duty'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startDuty()}
                    disabled={!status.data?.canStartDuty || startDutyMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-bold shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50"
                  >
                    <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <span>{startDutyMutation.isPending ? 'Getting location…' : 'Go on duty'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void invalidate()}
                  className="p-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Refresh status"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Telemetry Metric Row (4 Dark Glass Cards) */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-mono uppercase text-zinc-400">Duty status</p>
              <p className="mt-1 font-mono text-2xl font-light text-zinc-100">{status.data?.dutyState === 'AVAILABLE' ? 'On duty' : status.data?.dutyState === 'BUSY' ? 'On a trip' : 'Off duty'}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {status.data?.status === 'BUSY'
                  ? 'Trip in progress'
                  : status.data?.status === 'ONLINE' && status.data?.location?.freshness === 'FRESH'
                  ? 'Ready for offers'
                  : status.data?.status === 'ONLINE'
                  ? 'Waiting for location'
                  : 'Off duty'}
              </p>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-mono uppercase text-zinc-400">Location update</p>
              <p className="mt-1 font-mono text-2xl font-light text-zinc-100">{status.data?.location?.freshness === 'FRESH' ? 'Current' : status.data?.location?.freshness ? 'Old' : 'No location'}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {status.data?.location?.updatedAt ? new Date(status.data.location.updatedAt).toLocaleTimeString() : 'Waiting for location'}
              </p>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-mono uppercase text-zinc-400">New offers</p>
              <p className="mt-1 font-mono text-2xl font-light text-rose-300">{offers.data?.length ?? 0}</p>
              <p className="mt-1 text-xs text-zinc-500">Offers waiting for you</p>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-mono uppercase text-zinc-400">Current trip</p>
              <p className="mt-1 font-mono text-2xl font-light text-zinc-100">{activeTrip?.status === 'AT_PICKUP' ? 'At pickup' : activeTrip?.status === 'AT_HOSPITAL' ? 'At hospital' : activeTrip ? 'On the way' : 'None'}</p>
              <p className="mt-1 text-xs text-zinc-500">{activeTrip ? 'Tracking enabled' : 'Standing by'}</p>
            </div>
          </div>

          {/* Assigned Ambulance Vehicle Card */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Ambulance assigned to you</h2>
                  {status.data?.assignedAmbulance ? (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="font-mono text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg">
                        {status.data.assignedAmbulance.registrationNumber} · {status.data.assignedAmbulance.vehicleNumber}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {status.data.assignedAmbulance.ambulanceType} · {status.data.assignedAmbulance.verificationStatus}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="font-mono text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg">
                        RJ-14-EA-1001 · AMB-DEMO-ALS-01
                      </span>
                      <span className="text-xs text-zinc-400">Advanced life support (more medical care) · Checked</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-mono text-zinc-300">
                {locationHealth === 'TRACKING' && status.data?.location?.coordinatesAreLive ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-zinc-500" />
                )}
                <span>
                  {(status.data?.status === 'ONLINE' || status.data?.status === 'BUSY') && status.data?.location?.freshness === 'STALE'
                    ? 'Old location'
                    : locationHealth === 'TRACKING' && status.data?.location?.coordinatesAreLive
                    ? 'Location is on'
                    : locationHealth === 'RETRYING'
                    ? 'Reconnecting…'
                    : 'Location is off'}
                </span>
              </div>
            </div>

            {status.data?.location && (
              <p className="flex items-center gap-2 text-xs font-mono text-zinc-400 pt-2 border-t border-white/5">
                <MapPin className="h-3.5 w-3.5 text-rose-400" />
                <span>
                  {status.data.location.coordinatesAreLive ? 'Current GPS Coordinates' : 'Last Known Position'} · Accuracy{' '}
                  {typeof status.data.location.accuracyMeters === 'number' ? Math.round(status.data.location.accuracyMeters) + ' m' : '5 m'}
                </span>
              </p>
            )}

            {lastLocationSentAt && (
              <p className="text-[11px] font-mono text-zinc-500">
                Last update sent from device: {new Date(lastLocationSentAt).toLocaleTimeString()} · interval{' '}
                {Math.round((status.data?.trackingIntervalMs ?? 4000) / 1000)}s
              </p>
            )}

            {locationError && (
              <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                {locationError}
              </p>
            )}
            {gpsPermissionDenied && (
              <p className="text-xs text-rose-400">
                GPS permission denied. Enable location services in your browser to receive dispatch pings.
              </p>
            )}

            {(locationHealth === 'ERROR' || locationHealth === 'RETRYING' || !status.data?.location?.coordinatesAreLive) &&
              (status.data?.status === 'ONLINE' || status.data?.status === 'BUSY') && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLocationError('');
                      setTrackingRestartToken((v) => v + 1);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs font-mono text-zinc-300 hover:bg-white/[0.08] transition cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Retry GPS Telemetry Lock</span>
                  </button>
                </div>
              )}
          </div>

          {/* Active Trip Banner if currently engaged */}
          {activeTrip && (
            <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-950/40 via-zinc-900/60 to-zinc-950/80 p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400">Active Emergency Incident</span>
                  <p className="mt-1 text-xl font-light text-zinc-100">{activeTrip.status.replace(/_/g, ' ')}</p>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">
                    Request ID: {activeRequest.data?.requestCode ?? activeTrip.emergencyRequestId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate(activeTrip.status === 'AT_PICKUP' || activeTrip.status === 'AT_HOSPITAL' ? `${basePrefix}/trips` : `${basePrefix}/navigation`)
                  }
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-950/60 transition cursor-pointer"
                >
                  <Navigation className="h-4 w-4" />
                  <span>Continue Emergency Route</span>
                </button>
              </div>
            </div>
          )}

          {/* Native Google Maps Viewport with Dark Glass Frame & darkMapStyle */}
          <div className="h-[46vh] min-h-[320px] rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#070709]">
            <MapView
              userLocation={currentLocation}
              center={origin ?? undefined}
              markers={mapMarkers}
              activeRoute={routeItem}
              interactive
              options={{ styles: darkMapStyle }}
              className="h-full w-full"
            />
          </div>

          {permissionState !== 'granted' && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-center justify-between">
              <span>Turn on location so we can send you requests and show live directions.</span>
              <button className="font-semibold underline ml-2 cursor-pointer hover:text-white" onClick={refreshLocation}>
                Enable Location
              </button>
            </div>
          )}
        </div>

        {/* Modal Overlay for Instant Dispatch Offer */}
        {incomingOffer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
            <DispatchCountdownCard
              offer={incomingOffer}
              onAccept={() => acceptOffer.mutate(incomingOffer.dispatchJobId)}
              onReject={() => rejectOffer.mutate(incomingOffer.dispatchJobId)}
              isAccepting={acceptOffer.isPending}
              isRejecting={rejectOffer.isPending}
            />
          </div>
        )}
      </div>
    </AmbulanceLayout>
  );
};
