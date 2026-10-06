import type {Ambulance,AmbulanceRequest,Driver,Pagination,ProviderProfile,Trip} from '../types/ambulanceOperations';
const API_BASE=((import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??'http://localhost:5001/api/v1');
export class AmbulanceProviderApiError extends Error{readonly status:number;readonly code:string;constructor(status:number,code:string,message:string){super(message);this.name='AmbulanceProviderApiError';this.status=status;this.code=code}}
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${API_BASE}${path}`,{...init,credentials:'include',headers:{'Content-Type':'application/json',...(init.headers??{})}});const payload:unknown=await response.json().catch(()=>null);if(!response.ok){const error=payload&&typeof payload==='object'&&'error'in payload?(payload as {error?:{code?:string;message?:string}}).error:undefined;throw new AmbulanceProviderApiError(response.status,error?.code??'REQUEST_FAILED',error?.message??'The provider request failed.')}if(!payload||typeof payload!=='object'||!('data'in payload))throw new AmbulanceProviderApiError(response.status,'INVALID_RESPONSE','Invalid server response');return(payload as {data:T}).data}
const qs=(p:Record<string,unknown>)=>{const s=new URLSearchParams();Object.entries(p).forEach(([k,v])=>{if(v!==undefined&&v!=='')s.set(k,String(v))});const x=s.toString();return x?`?${x}`:''};
export const ambulanceProviderApi={
getProfile:()=>request<ProviderProfile>('/ambulance-provider/profile'),
updateProfile:(body:Partial<ProviderProfile>)=>request<ProviderProfile>('/ambulance-provider/profile',{method:'PATCH',body:JSON.stringify(body)}),
getAmbulances:(p:Record<string,unknown>={})=>request<{items:Ambulance[];pagination:Pagination}>(`/ambulance-provider/ambulances${qs(p)}`),
getAmbulance:(id:string)=>request<Ambulance>(`/ambulance-provider/ambulances/${encodeURIComponent(id)}`),
createAmbulance:(body:unknown)=>request<Ambulance>('/ambulance-provider/ambulances',{method:'POST',body:JSON.stringify(body)}),
updateAmbulance:(id:string,body:unknown)=>request<Ambulance>(`/ambulance-provider/ambulances/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)}),
updateAmbulanceStatus:(id:string,status:string)=>request<Ambulance>(`/ambulance-provider/ambulances/${encodeURIComponent(id)}/status`,{method:'PATCH',body:JSON.stringify({status})}),
getDrivers:(p:Record<string,unknown>={})=>request<{items:Driver[];pagination:Pagination}>(`/ambulance-provider/drivers${qs(p)}`),
getDriver:(id:string)=>request<Driver>(`/ambulance-provider/drivers/${encodeURIComponent(id)}`),
createDriver:(body:unknown)=>request<Driver>('/ambulance-provider/drivers',{method:'POST',body:JSON.stringify(body)}),
updateDriver:(id:string,body:unknown)=>request<Driver>(`/ambulance-provider/drivers/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)}),
assignDriver:(ambulanceId:string,driverId:string)=>request<Driver>(`/ambulance-provider/ambulances/${encodeURIComponent(ambulanceId)}/assign-driver`,{method:'PATCH',body:JSON.stringify({driverId})}),
unassignDriver:(ambulanceId:string)=>request<{unassigned:boolean}>(`/ambulance-provider/ambulances/${encodeURIComponent(ambulanceId)}/unassign-driver`,{method:'PATCH'}),
getRequests:(p:Record<string,unknown>={})=>request<{items:AmbulanceRequest[];pagination:Pagination}>(`/ambulance-provider/requests${qs(p)}`),
getRequest:(id:string)=>request<AmbulanceRequest>(`/ambulance-provider/requests/${encodeURIComponent(id)}`),
assignRequest:(id:string,ambulanceId:string)=>request<AmbulanceRequest>(`/ambulance-provider/requests/${encodeURIComponent(id)}/assign`,{method:'POST',body:JSON.stringify({ambulanceId})}),
getTrips:(p:Record<string,unknown>={})=>request<{items:Trip[];pagination:Pagination}>(`/ambulance-provider/trips${qs(p)}`),
getTrip:(id:string)=>request<Trip>(`/ambulance-provider/trips/${encodeURIComponent(id)}`),
};
