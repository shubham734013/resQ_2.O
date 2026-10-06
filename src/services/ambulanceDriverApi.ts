import type {AmbulanceRequest,Driver,Pagination,Trip} from '../types/ambulanceOperations';
const API_BASE=((import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??'http://localhost:5001/api/v1');
export class AmbulanceDriverApiError extends Error{readonly status:number;readonly code:string;constructor(status:number,code:string,message:string){super(message);this.name='AmbulanceDriverApiError';this.status=status;this.code=code}}
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${API_BASE}${path}`,{...init,credentials:'include',headers:{'Content-Type':'application/json',...(init.headers??{})}});const payload:unknown=await response.json().catch(()=>null);if(!response.ok){const error=payload&&typeof payload==='object'&&'error'in payload?(payload as {error?:{code?:string;message?:string}}).error:undefined;throw new AmbulanceDriverApiError(response.status,error?.code??'REQUEST_FAILED',error?.message??'The driver request failed.')}if(!payload||typeof payload!=='object'||!('data'in payload))throw new AmbulanceDriverApiError(response.status,'INVALID_RESPONSE','Invalid server response');return(payload as {data:T}).data}
const qs=(p:Record<string,unknown>)=>{const s=new URLSearchParams();Object.entries(p).forEach(([k,v])=>{if(v!==undefined&&v!=='')s.set(k,String(v))});const x=s.toString();return x?`?${x}`:''};
export const ambulanceDriverApi={
getProfile:()=>request<Driver>('/ambulance-driver/profile'),
updateProfile:(body:unknown)=>request<Driver>('/ambulance-driver/profile',{method:'PATCH',body:JSON.stringify(body)}),
getStatus:()=>request<{status:string;updatedAt:string}>('/ambulance-driver/status'),
updateStatus:(status:string)=>request<{status:string;updatedAt:string}>('/ambulance-driver/status',{method:'PATCH',body:JSON.stringify({status})}),
getRequests:(p:Record<string,unknown>={})=>request<{items:AmbulanceRequest[];pagination:Pagination}>(`/ambulance-driver/requests${qs(p)}`),
getRequest:(id:string)=>request<AmbulanceRequest>(`/ambulance-driver/requests/${encodeURIComponent(id)}`),
acceptRequest:(id:string)=>request<Trip>(`/ambulance-driver/requests/${encodeURIComponent(id)}/accept`,{method:'POST'}),
rejectRequest:(id:string)=>request<AmbulanceRequest>(`/ambulance-driver/requests/${encodeURIComponent(id)}/reject`,{method:'POST'}),
getTrips:(p:Record<string,unknown>={})=>request<{items:Trip[];pagination:Pagination}>(`/ambulance-driver/trips${qs(p)}`),
getTrip:(id:string)=>request<Trip>(`/ambulance-driver/trips/${encodeURIComponent(id)}`),
arrivedPickup:(id:string)=>request<Trip>(`/ambulance-driver/trips/${encodeURIComponent(id)}/arrived-pickup`,{method:'POST'}),
patientPickedUp:(id:string)=>request<Trip>(`/ambulance-driver/trips/${encodeURIComponent(id)}/patient-picked-up`,{method:'POST'}),
arrivedHospital:(id:string)=>request<Trip>(`/ambulance-driver/trips/${encodeURIComponent(id)}/arrived-hospital`,{method:'POST'}),
completeTrip:(id:string)=>request<Trip>(`/ambulance-driver/trips/${encodeURIComponent(id)}/complete`,{method:'POST'}),
};
