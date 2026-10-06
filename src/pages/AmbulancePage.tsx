import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Hospital, MapPin, Phone, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/common/Button';
import { AmbulanceStatus } from '../components/ambulance/AmbulanceStatus';
import { AmbulanceLayout } from '../components/ambulance/AmbulanceLayout';
import { NavigationPanel } from '../components/ambulance/NavigationPanel';
import { TripAction } from '../components/ambulance/TripAction';
import { MapView } from '../components/map/MapView';
import { ambulanceDriverApi } from '../services/ambulanceDriverApi';
import { useAmbulanceRoute } from '../hooks/useAmbulanceRoute';
import type { UserLocation } from '../types/facility';
import type { RouteOptionItem } from '../types/route';

interface LayoutContext {
  currentLocation: UserLocation;
  location: { latitude:number; longitude:number; accuracyMeters?:number; timestamp:number } | null;
  permissionState: 'prompt'|'granted'|'denied'|'unsupported'|'unknown';
  refreshLocation: () => void;
  isUpdating: boolean;
}

const navigationFor=(route:RouteOptionItem)=>({
 instruction:route.instructions[0]?.instruction ?? 'Follow the highlighted route',
 eta:route.duration,distance:route.distance,currentStepIndex:0,
});

export const AmbulancePage=()=>{
 const navigate=useNavigate();
 const {pathname}=useLocation();
 const qc=useQueryClient();
 const {currentLocation,location,permissionState,refreshLocation}=useOutletContext<LayoutContext>();
 const routeMode=pathname.replace('/ambulance','').replace(/^\//,'');
 const profile=useQuery({queryKey:['ambulance-driver','profile'],queryFn:ambulanceDriverApi.getProfile});
 const status=useQuery({queryKey:['ambulance-driver','status'],queryFn:ambulanceDriverApi.getStatus});
 const requests=useQuery({queryKey:['ambulance-driver','requests'],queryFn:()=>ambulanceDriverApi.getRequests({limit:20})});
 const trips=useQuery({queryKey:['ambulance-driver','trips'],queryFn:()=>ambulanceDriverApi.getTrips({limit:20})});
 const activeTrip=useMemo(()=>trips.data?.items.find(t=>!['COMPLETED','CANCELLED'].includes(t.status))??null,[trips.data?.items]);
 const activeRequest=useQuery({queryKey:['ambulance-driver','request',activeTrip?.emergencyRequestId],queryFn:()=>ambulanceDriverApi.getRequest(activeTrip!.emergencyRequestId),enabled:Boolean(activeTrip?.emergencyRequestId)});
 const incoming=requests.data?.items.find(r=>!r.driverId && ['RECEIVED','REVIEWING','PREPARING','AMBULANCE_COORDINATION'].includes(r.status))??requests.data?.items[0]??null;
 const selectedRequest=routeMode==='request'?incoming:activeRequest.data??incoming;
 const destination=selectedRequest && typeof selectedRequest.latitude==='number' && typeof selectedRequest.longitude==='number'
   ? {latitude:selectedRequest.latitude,longitude:selectedRequest.longitude}:null;
 const origin=location?{latitude:location.latitude,longitude:location.longitude}:null;
 const route=useAmbulanceRoute(origin,destination);
 const routeItem=route.routes[0]??null;
 const invalidate=()=>Promise.all([qc.invalidateQueries({queryKey:['ambulance-driver']})]);
 const statusMutation=useMutation({mutationFn:(s:string)=>ambulanceDriverApi.updateStatus(s),onSuccess:invalidate});
 const accept=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.acceptRequest(id),onSuccess:async()=>{await invalidate();navigate('/ambulance/navigation');}});
 const reject=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.rejectRequest(id),onSuccess:async()=>{await invalidate();navigate('/ambulance');}});
 const pickup=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.arrivedPickup(id),onSuccess:async()=>{await invalidate();navigate('/ambulance/trip');}});
 const onboard=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.patientPickedUp(id),onSuccess:async()=>{await invalidate();navigate('/ambulance/navigation');}});
 const hospital=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.arrivedHospital(id),onSuccess:async()=>{await invalidate();navigate('/ambulance/trip');}});
 const complete=useMutation({mutationFn:(id:string)=>ambulanceDriverApi.completeTrip(id),onSuccess:async()=>{await invalidate();navigate('/ambulance/trip');}});

 const routeDestination=activeTrip?.status==='TO_HOSPITAL' || activeTrip?.status==='AT_HOSPITAL'
   ? (activeRequest.data && typeof activeRequest.data.latitude==='number' && typeof activeRequest.data.longitude==='number'
      ? {latitude:activeRequest.data.latitude,longitude:activeRequest.data.longitude}:null)
   : destination;

 if(routeMode==='request' && selectedRequest) return <AmbulanceLayout><div className="mx-auto w-full max-w-2xl px-4 py-8"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Incoming emergency</p><h1 className="mt-1 text-3xl font-bold">Emergency request</h1><div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 space-y-4"><div><p className="text-xs text-slate-500">Request</p><p className="font-semibold">{selectedRequest.requestCode}</p></div><div><p className="text-xs text-slate-500">Situation</p><p className="font-semibold">{selectedRequest.situationType}</p></div><div><p className="text-xs text-slate-500">Pickup</p><p className="font-semibold">{selectedRequest.location??'Coordinates provided by dispatch'}</p></div><div><p className="text-xs text-slate-500">Hospital</p><p className="font-semibold">Destination hospital ID: {selectedRequest.hospitalId}</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><Button size="lg" variant="emergency" fullWidth onClick={()=>accept.mutate(selectedRequest.id)} disabled={accept.isPending}>Accept Request</Button><Button size="lg" variant="secondary" fullWidth onClick={()=>reject.mutate(selectedRequest.id)} disabled={reject.isPending}>Reject</Button></div></div></AmbulanceLayout>;

 if(routeMode==='navigation' && activeTrip && routeItem && routeDestination){
   const toHospital=activeTrip.status==='TO_HOSPITAL';
   return <AmbulanceLayout><NavigationPanel title={toHospital?'Transporting to Hospital':'Navigate to Patient'} destinationName={toHospital?'Destination hospital':(selectedRequest?.location??'Patient pickup')} destinationAddress={selectedRequest?.location??'Dispatch coordinates'} destinationCoordinates={routeDestination} navigation={navigationFor(routeItem)} userLocation={currentLocation} route={routeItem} onAction={()=>toHospital?hospital.mutate(activeTrip.id):pickup.mutate(activeTrip.id)} actionLabel={toHospital?'Arrived at Hospital':'Arrived at Patient'} onCall={profile.data?.phone?()=>window.location.assign('tel:'+profile.data.phone):undefined}/></AmbulanceLayout>;
 }

 if(routeMode==='trip' && activeTrip?.status==='AT_PICKUP') return <AmbulanceLayout><div className="mx-auto w-full max-w-2xl px-4 py-8"><CheckCircle2 className="h-7 w-7 text-emerald-600"/><h1 className="mt-2 text-2xl font-bold">Arrived at Patient</h1><p className="mt-2 text-sm text-slate-500">Record patient handover only when the patient is onboard.</p><Button className="mt-6 min-h-14" size="lg" fullWidth onClick={()=>onboard.mutate(activeTrip.id)} disabled={onboard.isPending}>Patient Picked Up</Button></div></AmbulanceLayout>;

 if(routeMode==='trip' && activeTrip?.status==='AT_HOSPITAL') return <AmbulanceLayout><div className="mx-auto w-full max-w-2xl px-4 py-8"><Hospital className="h-7 w-7"/><h1 className="mt-2 text-2xl font-bold">Arrived at Hospital</h1><p className="mt-2 text-sm text-slate-500">Complete the trip after hospital handover.</p><Button className="mt-6 min-h-14" size="lg" fullWidth onClick={()=>complete.mutate(activeTrip.id)} disabled={complete.isPending}>Trip Completed</Button></div></AmbulanceLayout>;

 if(routeMode==='profile') return <AmbulanceLayout><div className="mx-auto w-full max-w-2xl px-4 py-8"><p className="text-xs uppercase tracking-wider text-slate-500">Driver profile</p><h1 className="mt-1 text-3xl font-bold">{profile.data?.fullName??'Driver'}</h1><div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 space-y-3"><p><span className="text-slate-500">Phone:</span> {profile.data?.phone}</p><p><span className="text-slate-500">License:</span> {profile.data?.licenseNumber}</p><p><span className="text-slate-500">Verification:</span> {profile.data?.licenseVerificationStatus}</p></div></div></AmbulanceLayout>;

 if(routeMode==='trips') return <AmbulanceLayout><div className="mx-auto w-full max-w-3xl px-4 py-8"><h1 className="text-2xl font-bold">Trip history</h1><div className="mt-5 space-y-3">{(trips.data?.items??[]).map(t=><div className="rounded-lg border border-slate-200 bg-white p-4" key={t.id}><div className="flex justify-between"><span className="font-semibold">{t.status}</span><span className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleString()}</span></div><p className="mt-2 text-sm text-slate-500">Request {t.emergencyRequestId}</p></div>)}</div></div></AmbulanceLayout>;

 return <AmbulanceLayout><div className="flex flex-1 flex-col"><div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ambulance driver</p><h1 className="mt-1 text-3xl font-bold">{profile.data?.fullName??'Driver'}</h1></div><AmbulanceStatus status={status.data?.status==='ONLINE'?'available':status.data?.status==='BUSY'?'busy':'offline'}/></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Status</p><p className="mt-1 font-semibold">{status.data?.status??'OFFLINE'}</p></div><div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Pending requests</p><p className="mt-1 text-2xl font-bold">{requests.data?.pagination.total??0}</p></div><div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Active trip</p><p className="mt-1 font-semibold">{activeTrip?.status??'None'}</p></div></div><div className="mt-5 h-[42vh] min-h-[280px] overflow-hidden rounded-lg border border-slate-200"><MapView userLocation={currentLocation} center={origin??undefined} interactive className="h-full w-full"/></div>{permissionState!=='granted'&&<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">Location access is required for real navigation. <button className="font-semibold underline" onClick={refreshLocation}>Enable location</button></div>}<div className="mt-4 flex gap-2">{status.data?.status==='ONLINE'?<Button variant="secondary" onClick={()=>statusMutation.mutate('OFFLINE')} disabled={statusMutation.isPending}>Go Offline</Button>:<Button onClick={()=>statusMutation.mutate('ONLINE')} disabled={statusMutation.isPending}>Go Online</Button>}<Button variant="secondary" onClick={()=>void invalidate()} icon={<RefreshCw className="h-4 w-4"/>}>Refresh</Button></div>{incoming&&<div className="mt-5 rounded-lg border border-rose-200 bg-white p-5"><p className="text-xs uppercase tracking-wider text-rose-600">Emergency request</p><h2 className="mt-1 text-xl font-bold">{incoming.requestCode}</h2><p className="mt-1 text-sm text-slate-500">{incoming.situationType}</p><Button className="mt-4 min-h-12" fullWidth onClick={()=>navigate('/ambulance/request')}>Review Request</Button></div>}{activeTrip&&<div className="mt-4 rounded-lg border border-slate-200 bg-white p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Current trip</p><p className="mt-1 text-xl font-bold">{activeTrip.status}</p><Button className="mt-4 min-h-12" fullWidth onClick={()=>navigate(activeTrip.status==='AT_PICKUP'||activeTrip.status==='AT_HOSPITAL'?'/ambulance/trip':'/ambulance/navigation')}>Continue Trip</Button></div>}</div></div></AmbulanceLayout>;
};