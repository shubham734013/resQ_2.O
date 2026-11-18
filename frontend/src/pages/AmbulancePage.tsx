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
      reject(new Error('This browser does not support GPS location. Open ResQ in a browser with Geolocation support.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  });

const navigationFor = (route: RouteOptionItem) => ({
  instruction: route.instructions[0]?.instruction ?? 'Follow the highlighted emergency corridor',
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
              <span>Priority Dispatch Offer</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight">Emergency Incident Offer</h1>
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
            <span>{expired ? 'Deadline Reached' : `${secondsLeft}s left`}</span>
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
              <p className="text-[11px] font-mono text-zinc-400 uppercase">Incident Request ID</p>
              <p className="font-mono text-base font-semibold text-rose-300 mt-0.5">
                {request?.requestCode ?? offer.dispatchJobId}
              </p>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                <AlertTriangle className="h-3.5 w-3.5" />
                {request?.situationType ?? request?.category ?? 'Acute Emergency'}
              </span>
            </div>
          </div>

          {/* Patient Pickup Location */}
          <div className="border-b border-white/5 pb-3.5">
            <p className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-rose-400" />
              Patient Pickup Target
            </p>
            <p className="font-medium text-zinc-100 text-sm mt-1">{request?.pickup.label || 'Confirmed Emergency Location'}</p>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {request?.pickup.latitude.toFixed(5)}, {request?.pickup.longitude.toFixed(5)}
            </p>
          </div>

          {/* Destination Hospital */}
          <div className="border-b border-white/5 pb-3.5">
            <p className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
              <Hospital className="h-3.5 w-3.5 text-emerald-400" />
              Designated Trauma Hospital
            </p>
            <p className="font-medium text-zinc-100 text-sm mt-1">{hospital?.name ?? 'Hospital Telemetry Available'}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{[hospital?.address, hospital?.city].filter(Boolean).join(', ')}</p>
            {hospital?.phone && (
              <a
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 hover:text-rose-300"
                href={`tel:${hospital.phone.replace(/[^0-9+]/g, '')}`}
              >
                <Phone className="h-3 w-3" />
                <span>Contact Hospital Desk: {hospital.phone}</span>
              </a>
            )}
          </div>

          {/* Route to Pickup info */}
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
            <p className="text-[11px] font-mono uppercase text-zinc-400">Route Telemetry to Patient</p>
            <p className="mt-1 text-xs font-mono text-zinc-200">
              {offer.route?.source === 'DRIVING' && typeof offer.route.etaSeconds === 'number'
                ? `${Math.max(1, Math.round(offer.route.etaSeconds / 60))} min ETA · ${(offer.route.distanceMeters / 1000).toFixed(1)} km driving`
                : 'Direct emergency transit route calculated.'}
            </p>
          </div>
        </div>

        {expired && (
          <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
            The server offer deadline has passed. Refresh to receive the next available emergency call offer.
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
            <span>{isAccepting ? 'Confirming Dispatch…' : 'Accept & Start Route'}</span>
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
          Authoritative server deadline is enforced. Once accepted, live patient tracking and telemetry stream activates automatically.
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
        title: activeRequest.data?.hospitalName || 'Destination Hospital',
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
      setLocationError(error instanceof Error ? error.message : 'Unable to start duty. Check GPS permission and retry.');
    }
  };

  useEffect(() => {
    const dutyStatus = status.data?.status;
    let disposed = false;
    if (dutyStatus !== 'ONLINE' && dutyStatus !== 'BUSY') return;
    if (!navigator.geolocation) {
      queueMicrotask(() => {
        if (!disposed) {
          setLocationHealth('ERROR');
          setLocationError('This browser does not support GPS. Live tracking is unavailable.');
        }
      });
      return () => {
        disposed = true;
      };
    }
    const intervalMs = Math.min(5000, Math.max(3000, status.data?.trackingIntervalMs ?? 4000));
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
              setLastLocationSentAt(Date.now());
              setLocationError('');
              setLocationHealth('TRACKING');
            })
            .catch((error) => {
              setLocationError(error instanceof Error ? error.message : 'GPS update failed. ResQ will retry.');
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
              void ambulanceDriverApi
                .endDuty()
                .then(() => invalidate())
                .catch(() => setLocationError('Location permission was revoked. Duty could not be ended automatically; end duty manually when safe.'));
            }
          } else {
            setLocationHealth('RETRYING');
            setLocationError(geolocationErrorMessage(error));
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
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
      navigate(`${basePrefix}/trip`);
    },
  });

  const onboard = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.patientPickedUp(id),
    onSuccess: async () => {
      await invalidate();
      navigate(`${basePrefix}/navigation`);
    },
  });

  const hospital = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.arrivedHospital(id),
    onSuccess: async () => {
      await invalidate();
      navigate(`${basePrefix}/trip`);
    },
  });

  const complete = useMutation({
    mutationFn: (id: string) => ambulanceDriverApi.completeTrip(id),
    onSuccess: async () => {
      await invalidate();
      navigate(`${basePrefix}/trip`);
    },
  });

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
              <h1 className="text-2xl font-light text-zinc-100 tracking-tight">No Active Dispatch Offer</h1>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Incoming emergency dispatch offers are ranked by the dispatch engine and streamed here in real time. Keep your duty toggle online.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => void offers.refetch()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 transition cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Refresh Dispatch Queue</span>
                </button>
              </div>
              {offers.isError && (
                <p role="alert" className="mt-3 text-xs text-rose-400">
                  Could not load dispatch offers. Check network connection and retry.
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
              <span>Route Calculation</span>
            </div>
            <h1 className="text-2xl font-light text-zinc-100 tracking-tight">
              {activeTrip.status === 'AT_HOSPITAL'
                ? 'Hospital Arrival Confirmed'
                : toHospital
                ? 'Calculating Hospital Route…'
                : 'Calculating Patient Route…'}
            </h1>
            <p role="status" className="text-sm text-zinc-400 leading-relaxed">
              {activeTrip.status === 'AT_HOSPITAL'
                ? 'Patient transfer at emergency intake verified. Complete the trip from Trip Actions.'
                : status.data?.location?.freshness !== 'FRESH'
                ? 'Acquiring satellite GPS lock. The last-known position is not used for active navigation.'
                : liveRoute.isError
                ? 'Route calculation temporarily delayed. Retry below to re-query Google Routes.'
                : 'Connecting to Google Directions navigation API…'}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => void liveRoute.refetch()}
                disabled={activeTrip.status === 'AT_HOSPITAL' || liveRoute.isFetching || !status.data?.location?.coordinatesAreLive}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry Route</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/driver/trips')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-semibold transition cursor-pointer"
              >
                <span>Trip Actions</span>
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
          title={toHospital ? 'Transporting to Hospital' : 'Navigate to Patient'}
          destinationName={toHospital ? activeRequest.data?.hospitalName ?? 'Destination Hospital' : selectedRequest?.location ?? 'Patient Pickup Point'}
          destinationAddress={
            toHospital
              ? activeRequest.data?.hospitalName
                ? `${activeRequest.data.hospitalName} Emergency Department`
                : 'Hospital Intake Bay'
              : selectedRequest?.location ?? 'Dispatch Coordinates'
          }
          destinationCoordinates={routeDestination}
          navigation={navigationFor(routeItem)}
          userLocation={currentLocation}
          route={routeItem}
          onAction={() => (toHospital ? hospital.mutate(activeTrip.id) : pickup.mutate(activeTrip.id))}
          actionLabel={toHospital ? 'Arrived at Hospital' : 'Arrived at Patient'}
          onCall={profile.data?.phone ? () => window.location.assign('tel:' + profile.data.phone) : undefined}
        />
      </AmbulanceLayout>
    );
  }

  /* ── 4. Patient Arrival Confirmation Mode ────────────────────────────── */
  if (routeMode === 'trip' && activeTrip?.status === 'AT_PICKUP') {
    return (
      <AmbulanceLayout>
        <div className="mx-auto w-full max-w-2xl px-4 py-12 font-sans">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-950/40">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">Arrived at Patient Location</h1>
              <p className="text-sm text-zinc-400 mt-1.5">
                Confirm patient pickup and onboarding once initial paramedic stabilization is complete.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onboard.mutate(activeTrip.id)}
              disabled={onboard.isPending}
              className="flex items-center justify-center gap-2 w-full min-h-14 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold text-sm shadow-xl shadow-emerald-950/60 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
            >
              <Navigation className="h-4 w-4" />
              <span>{onboard.isPending ? 'Updating Status…' : 'Patient Picked Up & Onboard'}</span>
            </button>
          </div>
        </div>
      </AmbulanceLayout>
    );
  }

  /* ── 5. Hospital Arrival Confirmation Mode ───────────────────────────── */
  if (routeMode === 'trip' && activeTrip?.status === 'AT_HOSPITAL') {
    return (
      <AmbulanceLayout>
        <div className="mx-auto w-full max-w-2xl px-4 py-12 font-sans">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-lg shadow-rose-950/40">
              <Hospital className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">Arrived at Destination Hospital</h1>
              <p className="text-sm text-zinc-400 mt-1.5">
                Complete the emergency trip after trauma team handover and patient transfer to emergency ward.
              </p>
            </div>
            <button
              type="button"
              onClick={() => complete.mutate(activeTrip.id)}
              disabled={complete.isPending}
              className="flex items-center justify-center gap-2 w-full min-h-14 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-xl shadow-rose-950/60 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{complete.isPending ? 'Finalizing Trip…' : 'Trip Handover Completed'}</span>
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
              <span>Telemetry Trip Audit & Activity Log</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">Trip History & Dispatch Logs</h1>
            <p className="text-xs md:text-sm text-zinc-400 mt-1">
              Historical record of emergency transport runs, patient handovers, and hospital drop-offs.
            </p>
          </div>

          {/* Dark Glass Panel Container */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
            {(trips.data?.items ?? []).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-zinc-400">No emergency transport trips recorded yet.</p>
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
                          {t.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">{new Date(t.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-mono text-zinc-400 pt-1">
                        Request ID: <span className="text-zinc-200">{t.emergencyRequestId}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-500">Trip Ref: {t.id.slice(-8)}</span>
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
                <span>Paramedic Fleet Command</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">
                {profile.data?.fullName ?? 'Responder Rajesh Sharma'}
              </h1>
              <p className="text-xs text-zinc-400 mt-1">Live telemetry, high-precision GPS, and emergency job offers.</p>
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
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Duty Controller</span>
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
                      {status.data?.status === 'ONLINE' ? 'ONLINE · DISPATCH READY' : status.data?.status === 'BUSY' ? 'ON ACTIVE TRIP' : 'OFFLINE'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 leading-snug">
                    {status.data?.status === 'ONLINE' && status.data?.location?.freshness === 'FRESH'
                      ? 'Satellite GPS live · Ready for dispatch offer assignment'
                      : status.data?.status === 'ONLINE'
                      ? 'On duty · Awaiting authoritative satellite fix'
                      : status.data?.status === 'BUSY'
                      ? 'Critical medical transit actively engaged'
                      : 'Toggle online to receive instant paramedic dispatch offers'}
                  </p>
                </div>
              </div>

              {/* Duty Controls */}
              <div className="flex items-center gap-3">
                {status.data?.status === 'BUSY' && status.data.activeTrip ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(activeTrip?.status === 'AT_PICKUP' || activeTrip?.status === 'AT_HOSPITAL' ? `${basePrefix}/trip` : `${basePrefix}/navigation`)
                    }
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-950/60 transition cursor-pointer"
                  >
                    <Navigation className="h-4 w-4" />
                    <span>Resume Route</span>
                  </button>
                ) : status.data?.status === 'ONLINE' || status.data?.status === 'BUSY' ? (
                  <button
                    type="button"
                    onClick={() => endDutyMutation.mutate()}
                    disabled={!status.data?.canEndDuty || endDutyMutation.isPending}
                    className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 transition cursor-pointer disabled:opacity-50"
                  >
                    {endDutyMutation.isPending ? 'Ending Duty…' : 'Go Offline'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startDuty()}
                    disabled={!status.data?.canStartDuty || startDutyMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-bold shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50"
                  >
                    <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <span>{startDutyMutation.isPending ? 'Locking GPS…' : 'Go Online'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void invalidate()}
                  className="p-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Refresh State"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Telemetry Metric Row (4 Dark Glass Cards) */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-mono uppercase text-zinc-400">Duty State</p>
              <p className="mt-1 font-mono text-2xl font-light text-zinc-100">{status.data?.dutyState ?? 'OFF_DUTY'}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {status.data?.status === 'BUSY'
                  ? 'Trip in progress'
                  : status.data?.status === 'ONLINE' && status.data?.location?.freshness === 'FRESH'
                  ? 'Eligible for dispatch'
                  : status.data?.status === 'ONLINE'
                  ? 'GPS pending fix'
                  : 'Idle offline'}
              </p>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-mono uppercase text-zinc-400">GPS Freshness</p>
              <p className="mt-1 font-mono text-2xl font-light text-zinc-100">{status.data?.location?.freshness ?? 'NO FIX'}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {status.data?.location?.updatedAt ? new Date(status.data.location.updatedAt).toLocaleTimeString() : 'Awaiting fix'}
              </p>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-mono uppercase text-zinc-400">Pending Offers</p>
              <p className="mt-1 font-mono text-2xl font-light text-rose-300">{offers.data?.length ?? 0}</p>
              <p className="mt-1 text-xs text-zinc-500">Authoritative queue</p>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-mono uppercase text-zinc-400">Active Trip Status</p>
              <p className="mt-1 font-mono text-2xl font-light text-zinc-100">{activeTrip?.status ?? 'NONE'}</p>
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
                  <h2 className="text-sm font-semibold text-zinc-100">Assigned Response Vehicle</h2>
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
                      <span className="text-xs text-zinc-400">Advanced Life Support · Verified</span>
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
                    ? 'Location Stale'
                    : locationHealth === 'TRACKING' && status.data?.location?.coordinatesAreLive
                    ? 'GPS Connected'
                    : locationHealth === 'RETRYING'
                    ? 'Reconnecting…'
                    : 'GPS Inactive'}
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
                    navigate(activeTrip.status === 'AT_PICKUP' || activeTrip.status === 'AT_HOSPITAL' ? `${basePrefix}/trip` : `${basePrefix}/navigation`)
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
              <span>Location access is required for real-time dispatch and live turn-by-turn routing.</span>
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
