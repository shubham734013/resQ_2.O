import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, Hospital, RefreshCw, MapPin, Wifi, WifiOff, ShieldCheck, Radio, Power, Navigation } from 'lucide-react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/common/Button';
import { AmbulanceStatus } from '../components/ambulance/AmbulanceStatus';
import { AmbulanceLayout } from '../components/ambulance/AmbulanceLayout';
import { NavigationPanel } from '../components/ambulance/NavigationPanel';
import { MapView } from '../components/map/MapView';
import { ambulanceDriverApi } from '../services/ambulanceDriverApi';
import { useAmbulanceRoute } from '../hooks/useAmbulanceRoute';
import { trackingApi, trackingRouteOption } from '../services/trackingApi';
import { useLocationState } from '../hooks/useLocationState';
import type { UserLocation } from '../types/facility';
import type { RouteOptionItem } from '../types/route';

interface LayoutContext {
  currentLocation: UserLocation;
  location: { latitude:number; longitude:number; accuracyMeters?:number; timestamp:number } | null;
  permissionState: 'prompt'|'granted'|'denied'|'unsupported'|'unknown';
  refreshLocation: () => void;
  isUpdating: boolean;
}

const geolocationErrorMessage = (error: GeolocationPositionError) => {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission was denied. Enable location access in your browser settings to start or continue duty.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'Your device could not determine its location. Move to an area with GPS reception and retry.';
  return 'GPS did not respond in time. ResQ will retry automatically while you remain on duty.';
};
const getCurrentGpsFix = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('This browser does not support GPS location. Open ResQ in a browser with Geolocation support.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
});

const navigationFor=(route:RouteOptionItem)=>({
 instruction:route.instructions[0]?.instruction ?? 'Follow the highlighted route',
 eta:route.duration,distance:route.distance,currentStepIndex:0,
});

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
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Authenticated dispatch offer</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Emergency request</h1>
        </div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold font-mono ${expired ? 'border-slate-300 bg-slate-100 text-slate-600' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          <Clock className="h-4 w-4" />
          <span>{expired ? 'Deadline reached' : `${secondsLeft}s left`}</span>
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full transition-all ${secondsLeft <= 5 ? 'bg-rose-600' : secondsLeft <= 12 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><p className="text-xs text-slate-500">Request code</p><p className="font-mono text-lg font-bold text-slate-900">{request?.requestCode ?? 'Emergency request'}</p></div>
        <div><p className="text-xs text-slate-500">Emergency type</p><p className="font-semibold text-slate-900">{request?.situationType ?? request?.category ?? 'Acute emergency'}</p></div>
        <div><p className="text-xs text-slate-500">Patient pickup</p><p className="font-semibold text-slate-900">{request?.pickup.label || 'Confirmed pickup coordinates'}</p><p className="mt-1 font-mono text-xs text-slate-500">{request?.pickup.latitude.toFixed(5)}, {request?.pickup.longitude.toFixed(5)}</p></div>
        <div><p className="text-xs text-slate-500">Selected destination hospital</p><p className="font-semibold text-slate-900">{hospital?.name ?? 'Hospital details unavailable'}</p><p className="text-sm text-slate-500">{[hospital?.address, hospital?.city].filter(Boolean).join(', ')}</p>{hospital?.phone && <a className="text-sm font-semibold text-blue-700 underline" href={`tel:${hospital.phone.replace(/[^0-9+]/g, '')}`}>Hospital contact: {hospital.phone}</a>}</div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">Route to pickup</p><p className="mt-1 text-sm text-slate-800">{offer.route?.source === 'DRIVING' && typeof offer.route.etaSeconds === 'number' ? `${Math.max(1, Math.round(offer.route.etaSeconds / 60))} min · ${(offer.route.distanceMeters / 1000).toFixed(1)} km driving` : 'Driving route unavailable; ranking used straight-line fallback.'}</p></div>
      </div>
      {expired && <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">The server deadline has passed or is expiring. This page will refresh offers; the local countdown does not expire or reject the offer.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Button size="lg" variant="emergency" fullWidth onClick={onAccept} disabled={isAccepting || isRejecting || expired} className="min-h-12 font-bold">{isAccepting ? 'Validating and accepting…' : 'Accept dispatch'}</Button>
        <Button size="lg" variant="secondary" fullWidth onClick={onReject} disabled={isRejecting || isAccepting || expired} className="min-h-12">{isRejecting ? 'Declining…' : 'Decline offer'}</Button>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">The server deadline is authoritative. A trip is created only after backend eligibility and reservation checks succeed.</p>
    </div>
  );
};

export const AmbulancePage=()=>{
 const navigate=useNavigate();
 const {pathname}=useLocation();
 const qc=useQueryClient();
 const outletContext = useOutletContext<LayoutContext | undefined>();
 const fallbackLocationState = useLocationState();
 const currentLocation = outletContext?.currentLocation ?? fallbackLocationState.currentLocation;
 const location = outletContext?.location ?? fallbackLocationState.location;
 const permissionState = outletContext?.permissionState ?? fallbackLocationState.permissionState;
 const refreshLocation = outletContext?.refreshLocation ?? fallbackLocationState.refreshLocation;
 const routeMode=pathname.replace('/ambulance','').replace(/^\//,'');
 const profile=useQuery({queryKey:['ambulance-driver','profile'],queryFn:ambulanceDriverApi.getProfile});
 const status=useQuery({queryKey:['ambulance-driver','status'],queryFn:ambulanceDriverApi.getStatus,refetchInterval:5000,refetchOnWindowFocus:true});
 const requests=useQuery({queryKey:['ambulance-driver','requests'],queryFn:()=>ambulanceDriverApi.getRequests({limit:20})});
 const offers=useQuery({queryKey:['ambulance-driver','dispatch-offers'],queryFn:ambulanceDriverApi.getDispatchOffers,refetchInterval:2000,refetchOnWindowFocus:true});
 const trips=useQuery({queryKey:['ambulance-driver','trips'],queryFn:()=>ambulanceDriverApi.getTrips({limit:20})});
 const activeTrip=useMemo(()=>trips.data?.items.find(t=>!['COMPLETED','CANCELLED'].includes(t.status))??null,[trips.data?.items]);
 const [locationHealth,setLocationHealth]=useState<'PAUSED'|'TRACKING'|'RETRYING'|'ERROR'>('PAUSED');
 const [locationError,setLocationError]=useState('');
 const [lastLocationSentAt,setLastLocationSentAt]=useState<number|null>(null);
 const [gpsPermissionDenied,setGpsPermissionDenied]=useState(false);
 const [trackingRestartToken,setTrackingRestartToken]=useState(0);
 const lastGpsSentAtRef=useRef(0);
 const locationRequestInFlightRef=useRef(false);


 const activeRequest=useQuery({queryKey:['ambulance-driver','request',activeTrip?.emergencyRequestId],queryFn:()=>ambulanceDriverApi.getRequest(activeTrip!.emergencyRequestId),enabled:Boolean(activeTrip?.emergencyRequestId)});
 const incoming=requests.data?.items.find(r=>!r.driverId && ['RECEIVED','REVIEWING','PREPARING','AMBULANCE_COORDINATION'].includes(r.status))??requests.data?.items[0]??null;
 const incomingOffer=offers.data?.[0]??null;
 const selectedRequest=routeMode==='request'?incoming:activeRequest.data??incoming;
 const destination=selectedRequest && typeof selectedRequest.latitude==='number' && typeof selectedRequest.longitude==='number'
   ? {latitude:selectedRequest.latitude,longitude:selectedRequest.longitude}:null;
 const origin=location?{latitude:location.latitude,longitude:location.longitude}:null;
  const toHospital=activeTrip?.status==='PATIENT_ONBOARD' || activeTrip?.status==='TO_HOSPITAL' || activeTrip?.status==='AT_HOSPITAL';
 const routeDestination=toHospital
   ? (activeRequest.data && typeof activeRequest.data.hospitalLatitude==='number' && typeof activeRequest.data.hospitalLongitude==='number'
      ? {latitude:activeRequest.data.hospitalLatitude,longitude:activeRequest.data.hospitalLongitude}:destination)
   : destination;
 const route=useAmbulanceRoute(origin,destination,!activeTrip);
 const liveRoute=useQuery({
   queryKey:['ambulance-driver','live-route',activeTrip?.id,toHospital?'HOSPITAL':'PICKUP',origin?.latitude.toFixed(3),origin?.longitude.toFixed(3)],
   queryFn:()=>trackingApi.getRoute(activeTrip!.id),
   enabled:Boolean(activeTrip&&routeDestination&&status.data?.location?.coordinatesAreLive&&!['AT_HOSPITAL','COMPLETED','CANCELLED'].includes(activeTrip.status)),
   staleTime:18000,
   refetchInterval:activeTrip&&routeDestination&&status.data?.location?.coordinatesAreLive&&!['AT_HOSPITAL','COMPLETED','CANCELLED'].includes(activeTrip.status)?20000:false,
   retry:1,
 });
 const routeItem=activeTrip
   ? (activeTrip.status==='AT_HOSPITAL'||liveRoute.isError?null:liveRoute.data?.routes[0]?trackingRouteOption(liveRoute.data.routes[0]):null)
   : route.routes[0]??null;
 const invalidate=useCallback(()=>Promise.all([qc.invalidateQueries({queryKey:['ambulance-driver']})]),[qc]);
 const startDutyMutation=useMutation({
   mutationFn:(fix:{latitude:number;longitude:number;accuracy:number;timestamp:number})=>ambulanceDriverApi.startDuty(fix),
   onSuccess:async()=>{lastGpsSentAtRef.current=Date.now();setGpsPermissionDenied(false);setLocationError('');setLocationHealth('RETRYING');await invalidate();}
 });
 const endDutyMutation=useMutation({
   mutationFn:()=>ambulanceDriverApi.endDuty(),
   onSuccess:async()=>{setLocationHealth('PAUSED');setLocationError('');lastGpsSentAtRef.current=0;await invalidate();}
 });
 const startDuty=async()=>{
   setLocationError('');setGpsPermissionDenied(false);
   try {
     const position=await getCurrentGpsFix();
     await startDutyMutation.mutateAsync({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp});
   } catch(error) {
     if(error && typeof error==='object' && 'code' in error && (error as GeolocationPositionError).code===1) setGpsPermissionDenied(true);
     setLocationHealth('ERROR');
     setLocationError(error instanceof Error ? error.message : 'Unable to start duty. Check GPS permission and retry.');
   }
 };
 useEffect(()=>{
   const dutyStatus=status.data?.status;
   let disposed=false;
   if(dutyStatus!=='ONLINE'&&dutyStatus!=='BUSY')return;
   if(!navigator.geolocation){queueMicrotask(()=>{if(!disposed){setLocationHealth('ERROR');setLocationError('This browser does not support GPS. Live tracking is unavailable.');}});return()=>{disposed=true;};}
   const intervalMs=Math.min(5000,Math.max(3000,status.data?.trackingIntervalMs??4000));
   let permissionFailureHandled=false;
   const requestFix=()=>{
     if(disposed||locationRequestInFlightRef.current)return;
     locationRequestInFlightRef.current=true;
     navigator.geolocation.getCurrentPosition(position=>{
       if(disposed){locationRequestInFlightRef.current=false;return;}
       setGpsPermissionDenied(false);
       lastGpsSentAtRef.current=Date.now();
       void ambulanceDriverApi.updateLocation({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp})
         .then(()=>{setLastLocationSentAt(Date.now());setLocationError('');setLocationHealth('TRACKING');})
         .catch(error=>{setLocationError(error instanceof Error?error.message:'GPS update failed. ResQ will retry.');setLocationHealth('RETRYING');})
         .finally(()=>{locationRequestInFlightRef.current=false;});
     },error=>{
       locationRequestInFlightRef.current=false;
       if(error.code===error.PERMISSION_DENIED){
         window.clearInterval(timer);
         setGpsPermissionDenied(true);setLocationHealth('ERROR');setLocationError(geolocationErrorMessage(error));
         if(!permissionFailureHandled&&dutyStatus==='ONLINE'){permissionFailureHandled=true;void ambulanceDriverApi.endDuty().then(()=>invalidate()).catch(()=>setLocationError('Location permission was revoked. Duty could not be ended automatically; end duty manually when safe.'));}
       }else{setLocationHealth('RETRYING');setLocationError(geolocationErrorMessage(error));}
     },{enableHighAccuracy:true,maximumAge:0,timeout:12000});
   };
   const timer=window.setInterval(requestFix,intervalMs);
   queueMicrotask(()=>{if(!disposed)setLocationHealth('RETRYING');});
   requestFix();
   return()=>{disposed=true;window.clearInterval(timer);locationRequestInFlightRef.current=false;};
 },[status.data?.status,status.data?.trackingIntervalMs,invalidate,trackingRestartToken]);
 const acceptOffer=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.acceptDispatchOffer(id),onSuccess:async()=>{await invalidate();await qc.invalidateQueries({queryKey:['ambulance-driver','dispatch-offers']});navigate('/ambulance/navigation');}});
 const rejectOffer=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.rejectDispatchOffer(id),onSuccess:async()=>{await invalidate();await qc.invalidateQueries({queryKey:['ambulance-driver','dispatch-offers']});navigate('/ambulance');}});
 const pickup=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.arrivedPickup(id),onSuccess:async()=>{await invalidate();navigate('/ambulance/trip');}});
 const onboard=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.patientPickedUp(id),onSuccess:async()=>{await invalidate();navigate('/ambulance/navigation');}});
 const hospital=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.arrivedHospital(id),onSuccess:async()=>{await invalidate();navigate('/ambulance/trip');}});
 const complete=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.completeTrip(id),onSuccess:async()=>{await invalidate();navigate('/ambulance/trip');}});



 if(routeMode==='request') {
   return (
     <AmbulanceLayout>
       {incomingOffer ? (
         <DispatchCountdownCard
           offer={incomingOffer}
           onAccept={()=>acceptOffer.mutate(incomingOffer.dispatchJobId)}
           onReject={()=>rejectOffer.mutate(incomingOffer.dispatchJobId)}
           isAccepting={acceptOffer.isPending}
           isRejecting={rejectOffer.isPending}
         />
       ) : (
         <div className="mx-auto w-full max-w-2xl px-4 py-10">
           <h1 className="text-2xl font-bold">No active dispatch offer</h1>
           <p className="mt-2 text-sm text-slate-600">Offers are assigned by the dispatch service and expire on the server. Refresh to check for a new offer.</p>
           <Button className="mt-5" onClick={()=>void offers.refetch()} icon={<RefreshCw className="h-4 w-4"/>}>Refresh offers</Button>
           {offers.isError && <p role="alert" className="mt-3 text-sm text-rose-700">Could not load offers. Check your connection and retry.</p>}
         </div>
       )}
     </AmbulanceLayout>
   );
 }

 if(routeMode==='navigation' && activeTrip && routeDestination && !routeItem){
   return <AmbulanceLayout><div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10"><h1 className="text-2xl font-bold">{activeTrip.status==='AT_HOSPITAL'?'Hospital arrival confirmed':toHospital?'Hospital navigation unavailable':'Pickup navigation unavailable'}</h1><p role="status" className="text-sm text-slate-600">{activeTrip.status==='AT_HOSPITAL'?'The driver confirmed hospital arrival. Complete the trip from Trip actions.':status.data?.location?.freshness!=='FRESH'?'Waiting for a fresh GPS fix. The last-known position is not used as live navigation.':liveRoute.isError?'Google Routes could not calculate a route right now. Retry when connectivity is restored.':'Calculating the current driving route…'}</p><div className="flex flex-wrap gap-2"><Button onClick={()=>void liveRoute.refetch()} disabled={activeTrip.status==='AT_HOSPITAL'||liveRoute.isFetching||!status.data?.location?.coordinatesAreLive} icon={<RefreshCw className="h-4 w-4"/>}>Retry route</Button><Button variant="secondary" onClick={()=>navigate('/ambulance/trip')}>Trip actions</Button></div></div></AmbulanceLayout>;
 }
 if(routeMode==='navigation' && activeTrip && routeItem && routeDestination){
   return <AmbulanceLayout><NavigationPanel title={toHospital?'Transporting to Hospital':'Navigate to Patient'} destinationName={toHospital?(activeRequest.data?.hospitalName??'Destination hospital'):(selectedRequest?.location??'Patient pickup')} destinationAddress={toHospital?(activeRequest.data?.hospitalName ? `${activeRequest.data.hospitalName} Emergency Department` : 'Hospital Intake'):(selectedRequest?.location??'Dispatch coordinates')} destinationCoordinates={routeDestination} navigation={navigationFor(routeItem)} userLocation={currentLocation} route={routeItem} onAction={()=>toHospital?hospital.mutate(activeTrip.id):pickup.mutate(activeTrip.id)} actionLabel={toHospital?'Arrived at Hospital':'Arrived at Patient'} onCall={profile.data?.phone?()=>window.location.assign('tel:'+profile.data.phone):undefined}/></AmbulanceLayout>;
 }

 if(routeMode==='trip' && activeTrip?.status==='AT_PICKUP') return <AmbulanceLayout><div className="mx-auto w-full max-w-2xl px-4 py-8"><CheckCircle2 className="h-7 w-7 text-emerald-600"/><h1 className="mt-2 text-2xl font-bold">Arrived at Patient</h1><p className="mt-2 text-sm text-slate-500">Record patient handover only when the patient is onboard.</p><Button className="mt-6 min-h-14" size="lg" fullWidth onClick={()=>onboard.mutate(activeTrip.id)} disabled={onboard.isPending}>Patient Picked Up</Button></div></AmbulanceLayout>;

 if(routeMode==='trip' && activeTrip?.status==='AT_HOSPITAL') return <AmbulanceLayout><div className="mx-auto w-full max-w-2xl px-4 py-8"><Hospital className="h-7 w-7"/><h1 className="mt-2 text-2xl font-bold">Arrived at Hospital</h1><p className="mt-2 text-sm text-slate-500">Complete the trip after hospital handover.</p><Button className="mt-6 min-h-14" size="lg" fullWidth onClick={()=>complete.mutate(activeTrip.id)} disabled={complete.isPending}>Trip Completed</Button></div></AmbulanceLayout>;

 if(routeMode==='profile') return <AmbulanceLayout><div className="mx-auto w-full max-w-2xl px-4 py-8"><p className="text-xs uppercase tracking-wider text-slate-500">Driver profile</p><h1 className="mt-1 text-3xl font-bold">{profile.data?.fullName??'Driver'}</h1><div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 space-y-3"><p><span className="text-slate-500">Phone:</span> {profile.data?.phone}</p><p><span className="text-slate-500">License:</span> {profile.data?.licenseNumber}</p><p><span className="text-slate-500">Verification:</span> {profile.data?.licenseVerificationStatus}</p></div></div></AmbulanceLayout>;

 if(routeMode==='trips') return <AmbulanceLayout><div className="mx-auto w-full max-w-3xl px-4 py-8"><h1 className="text-2xl font-bold">Trip history</h1><div className="mt-5 space-y-3">{(trips.data?.items??[]).map(t=><div className="rounded-lg border border-slate-200 bg-white p-4" key={t.id}><div className="flex justify-between"><span className="font-semibold">{t.status}</span><span className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleString()}</span></div><p className="mt-2 text-sm text-slate-500">Request {t.emergencyRequestId}</p></div>)}</div></div></AmbulanceLayout>;

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

  return (
    <AmbulanceLayout>
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ambulance Driver Command</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{profile.data?.fullName ?? 'Driver'}</h1>
            </div>
            <AmbulanceStatus status={status.data?.status === 'ONLINE' ? 'available' : status.data?.status === 'BUSY' ? 'busy' : 'offline'} />
          </div>

          {/* Uber-Style Tactile Duty Controller Banner */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div
                  className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${
                    status.data?.status === 'ONLINE'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : status.data?.status === 'BUSY'
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {status.data?.status === 'ONLINE' ? (
                    <>
                      <Radio className="h-6 w-6 animate-pulse" />
                      <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white animate-ping" />
                    </>
                  ) : status.data?.status === 'BUSY' ? (
                    <Navigation className="h-6 w-6" />
                  ) : (
                    <Power className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Duty Controller</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        status.data?.status === 'ONLINE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : status.data?.status === 'BUSY'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {status.data?.status === 'ONLINE' ? 'ONLINE · DISPATCH READY' : status.data?.status === 'BUSY' ? 'ON ACTIVE TRIP' : 'OFFLINE'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {status.data?.status === 'ONLINE' && status.data?.location?.freshness === 'FRESH'
                      ? 'GPS live · Automatic dispatch enabled'
                      : status.data?.status === 'ONLINE'
                      ? 'On duty · Waiting for GPS fix'
                      : status.data?.status === 'BUSY'
                      ? 'Emergency response in progress'
                      : 'Go online to receive incoming ambulance dispatches'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {status.data?.status === 'BUSY' && status.data.activeTrip ? (
                  <Button
                    variant="primary"
                    onClick={() => navigate(activeTrip?.status === 'AT_PICKUP' || activeTrip?.status === 'AT_HOSPITAL' ? '/ambulance/trip' : '/ambulance/navigation')}
                    icon={<Navigation className="h-4 w-4" />}
                  >
                    Resume Navigation
                  </Button>
                ) : status.data?.status === 'ONLINE' || status.data?.status === 'BUSY' ? (
                  <Button
                    variant="secondary"
                    onClick={() => endDutyMutation.mutate()}
                    disabled={!status.data?.canEndDuty || endDutyMutation.isPending}
                  >
                    {endDutyMutation.isPending ? 'Ending duty…' : 'Go Offline'}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => void startDuty()}
                    disabled={!status.data?.canStartDuty || startDutyMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6 py-2.5 shadow-lg shadow-emerald-600/20"
                    icon={<Radio className="h-4 w-4" />}
                  >
                    {startDutyMutation.isPending ? 'Connecting GPS…' : 'Go Online'}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => void invalidate()} icon={<RefreshCw className="h-4 w-4" />} title="Refresh" />
              </div>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Duty state</p>
              <p className="mt-1 font-semibold">{status.data?.dutyState ?? 'OFF_DUTY'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {status.data?.status === 'BUSY'
                  ? 'Trip in progress'
                  : status.data?.status === 'ONLINE' && status.data?.location?.freshness === 'FRESH'
                  ? 'Eligible for dispatch'
                  : status.data?.status === 'ONLINE'
                  ? 'GPS stale, dispatch paused'
                  : 'Not accepting offers'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">GPS freshness</p>
              <p className="mt-1 font-semibold">{status.data?.location?.freshness ?? 'NO FIX'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {status.data?.location?.updatedAt ? new Date(status.data.location.updatedAt).toLocaleTimeString() : 'No saved GPS fix'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Pending offers</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{offers.data?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Active trip</p>
              <p className="mt-1 font-semibold">{activeTrip?.status ?? 'None'}</p>
            </div>
          </div>

          {/* Vehicle and GPS Information Panel */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <ShieldCheck className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Assigned ambulance</h2>
                  {status.data?.assignedAmbulance ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {status.data.assignedAmbulance.vehicleNumber} · {status.data.assignedAmbulance.registrationNumber}
                      </p>
                      <p className="text-xs text-slate-500">
                        {status.data.assignedAmbulance.ambulanceType} · {status.data.assignedAmbulance.status} · {status.data.assignedAmbulance.verificationStatus}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-rose-700">No ambulance assigned. Ask your provider to assign an eligible ambulance before starting duty.</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {locationHealth === 'TRACKING' && status.data?.location?.coordinatesAreLive ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-slate-400" />}
                {(status.data?.status === 'ONLINE' || status.data?.status === 'BUSY') && status.data?.location?.freshness === 'STALE'
                  ? 'Location stale'
                  : locationHealth === 'TRACKING' && status.data?.location?.coordinatesAreLive
                  ? 'GPS connected'
                  : locationHealth === 'RETRYING'
                  ? 'Reconnecting GPS'
                  : locationHealth === 'ERROR'
                  ? 'GPS unavailable'
                  : 'Tracking paused'}
              </div>
            </div>

            {status.data?.location && (
              <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="h-4 w-4" />
                {status.data.location.coordinatesAreLive ? 'Current GPS fix' : 'Last known position — not live'} · accuracy{' '}
                {typeof status.data.location.accuracyMeters === 'number' ? Math.round(status.data.location.accuracyMeters) + ' m' : 'unknown'}
              </p>
            )}
            {lastLocationSentAt && (
              <p className="mt-1 text-xs text-slate-500">
                Last update sent from this device: {new Date(lastLocationSentAt).toLocaleTimeString()} · every{' '}
                {Math.round((status.data?.trackingIntervalMs ?? 4000) / 1000)} seconds while active
              </p>
            )}
            {locationError && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{locationError}</p>}
            {gpsPermissionDenied && <p className="mt-2 text-sm text-rose-700">GPS permission is denied. Change browser site settings and retry. Live dispatch eligibility requires a fresh location.</p>}
            {(locationHealth === 'ERROR' || locationHealth === 'RETRYING' || !status.data?.location?.coordinatesAreLive) && (status.data?.status === 'ONLINE' || status.data?.status === 'BUSY') && (
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => { setLocationError(''); setTrackingRestartToken((v) => v + 1); }}>Retry GPS tracking</Button>
              </div>
            )}
            {status.isError && <p role="alert" className="mt-3 text-sm text-rose-700">Could not load authoritative duty state. Refresh before starting or ending duty.</p>}
            {startDutyMutation.isError && <p role="alert" className="mt-2 text-sm text-rose-700">{startDutyMutation.error instanceof Error ? startDutyMutation.error.message : 'Could not start duty.'}</p>}
            {endDutyMutation.isError && <p role="alert" className="mt-2 text-sm text-rose-700">{endDutyMutation.error instanceof Error ? endDutyMutation.error.message : 'Could not end duty.'}</p>}
          </div>

          {/* Active Trip Banner if currently engaged */}
          {activeTrip && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Active Emergency Response</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{activeTrip.status.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-600">Request code: {activeRequest.data?.requestCode ?? activeTrip.emergencyRequestId}</p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => navigate(activeTrip.status === 'AT_PICKUP' || activeTrip.status === 'AT_HOSPITAL' ? '/ambulance/trip' : '/ambulance/navigation')}
                  icon={<Navigation className="h-4 w-4" />}
                >
                  Continue Trip Flow
                </Button>
              </div>
            </div>
          )}

          {/* Live Driver GIS Map */}
          <div className="mt-5 h-[44vh] min-h-[300px] overflow-hidden rounded-2xl border border-slate-200 shadow-md">
            <MapView
              userLocation={currentLocation}
              center={origin ?? undefined}
              markers={mapMarkers}
              activeRoute={routeItem}
              interactive
              className="h-full w-full"
            />
          </div>

          {permissionState !== 'granted' && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Location access is required for real navigation. <button className="font-semibold underline" onClick={refreshLocation}>Enable location</button>
            </div>
          )}
        </div>

        {/* Instant Uber Driver Dispatch Offer Modal Overlay */}
        {incomingOffer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200">
              <DispatchCountdownCard
                offer={incomingOffer}
                onAccept={() => acceptOffer.mutate(incomingOffer.dispatchJobId)}
                onReject={() => rejectOffer.mutate(incomingOffer.dispatchJobId)}
                isAccepting={acceptOffer.isPending}
                isRejecting={rejectOffer.isPending}
              />
            </div>
          </div>
        )}
      </div>
    </AmbulanceLayout>
  );
};