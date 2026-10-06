import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambulanceDriverApi } from '../services/ambulanceDriverApi';
import type { TripStatus } from '../types/ambulanceOperations';

const card='rounded-xl border border-slate-200 bg-white p-5';
const button='inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50';

export const AmbulancePage=()=>{
 const qc=useQueryClient();
 const profile=useQuery({queryKey:['ambulance-driver','profile'],queryFn:ambulanceDriverApi.getProfile});
 const status=useQuery({queryKey:['ambulance-driver','status'],queryFn:ambulanceDriverApi.getStatus});
 const requests=useQuery({queryKey:['ambulance-driver','requests'],queryFn:()=>ambulanceDriverApi.getRequests({limit:20})});
 const trips=useQuery({queryKey:['ambulance-driver','trips'],queryFn:()=>ambulanceDriverApi.getTrips({limit:20})});
 const refresh=()=>qc.invalidateQueries({queryKey:['ambulance-driver']});
 const statusMutation=useMutation({mutationFn:(s:string)=>ambulanceDriverApi.updateStatus(s),onSuccess:refresh});
 const accept=useMutation({mutationFn:ambulanceDriverApi.acceptRequest,onSuccess:refresh});
 const reject=useMutation({mutationFn:ambulanceDriverApi.rejectRequest,onSuccess:refresh});
 const actions:{status:TripStatus;label:string;fn:(id:string)=>Promise<unknown>}[]=[
  {status:'ACCEPTED',label:'Start trip / go to pickup',fn:ambulanceDriverApi.arrivedPickup},
  {status:'AT_PICKUP',label:'Patient picked up',fn:ambulanceDriverApi.patientPickedUp},
  {status:'PATIENT_ONBOARD',label:'Depart for hospital',fn:ambulanceDriverApi.arrivedHospital},
  {status:'AT_HOSPITAL',label:'Complete handover',fn:ambulanceDriverApi.completeTrip},
 ];
 const action=useMutation({mutationFn:({fn,id}:{fn:(id:string)=>Promise<unknown>;id:string})=>fn(id),onSuccess:refresh});
 const activeTrip=useMemo(()=>trips.data?.items.find(t=>!['COMPLETED','CANCELLED'].includes(t.status)),[trips.data]);
 const next=activeTrip?actions.find(x=>x.status===activeTrip.status):undefined;
 return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="sticky top-0 z-40 border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3"><div><p className="text-sm font-semibold">ResQ Ambulance</p><p className="text-[11px] text-slate-500">Driver operations</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{status.data?.status??'Loading'}</span></div></header>
 <div className="mx-auto max-w-3xl px-4 py-6"><section className={card}><p className="text-xs uppercase tracking-wider text-slate-500">Driver</p><h1 className="mt-1 text-2xl font-bold">{profile.data?.fullName??'Loading…'}</h1><p className="mt-1 text-sm text-slate-500">{profile.data?.licenseNumber??''}</p><div className="mt-5 flex gap-2">{['ONLINE','OFFLINE'].map(s=><button key={s} className={`rounded-lg px-4 py-2 text-sm font-semibold ${status.data?.status===s?'bg-slate-900 text-white':'border border-slate-300 bg-white'}`} disabled={statusMutation.isPending} onClick={()=>statusMutation.mutate(s)}>{s}</button>)}</div></section>
 {activeTrip&&<section className={`${card} mt-4`}><div className="flex justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">Active trip</p><h2 className="mt-1 text-xl font-bold">{activeTrip.status.replaceAll('_',' ')}</h2></div><span className="text-xs font-semibold">{activeTrip.emergencyRequestId.slice(-8)}</span></div><p className="mt-3 text-sm text-slate-600">Hospital destination: {activeTrip.destinationHospitalId}</p>{next&&<button className={`${button} mt-5 w-full`} disabled={action.isPending} onClick={()=>action.mutate({fn:next.fn,id:activeTrip.id})}>{next.label}</button>}</section>}
 <section className="mt-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Incoming requests</h2><button className="text-sm font-semibold text-slate-600" onClick={()=>refresh()}>Refresh</button></div><div className="space-y-3">{(requests.data?.items??[]).filter(r=>!r.driverId).map(r=><div className={card} key={r.id}><div className="flex justify-between"><div><p className="font-semibold">{r.requestCode}</p><p className="text-sm text-slate-600">{r.situationType}</p><p className="mt-1 text-xs text-slate-500">{r.location??'Pickup location unavailable'}</p></div><span className="text-xs font-bold">{r.ambulanceId?'Assigned':'Waiting'}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><button className={button} disabled={accept.isPending||!!activeTrip} onClick={()=>accept.mutate(r.id)}>Accept</button><button className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold" disabled={reject.isPending} onClick={()=>reject.mutate(r.id)}>Reject</button></div></div>)}</div></section>
 {!activeTrip&&status.data?.status==='ONLINE'&&<div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">You are online and eligible for assigned operational requests.</div>}
 {(profile.isError||status.isError||requests.isError||trips.isError)&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Unable to load current driver operations. Retry to fetch the latest backend state.</div>}
 </div></main>;
};
