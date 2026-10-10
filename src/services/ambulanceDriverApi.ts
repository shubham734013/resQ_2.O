import type {AmbulanceRequest,Driver,Pagination,Trip} from '../types/ambulanceOperations';
const API_BASE=(()=>{const value=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.trim();if(!value)throw new Error('VITE_API_BASE_URL is required.');return value.replace(/\/$/,'');})();
export class AmbulanceDriverApiError extends Error{readonly status:number;readonly code:string;constructor(status:number,code:string,message:string){super(message);this.name='AmbulanceDriverApiError';this.status=status;this.code=code}}
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${API_BASE}${path}`,{...init,credentials:'include',headers:{'Content-Type':'application/json',...(init.headers??{})}});const payload:unknown=await response.json().catch(()=>null);if(!response.ok){const error=payload&&typeof payload==='object'&&'error'in payload?(payload as {error?:{code?:string;message?:string}}).error:undefined;throw new AmbulanceDriverApiError(response.status,error?.code??'REQUEST_FAILED',error?.message??'The driver request failed.')}if(!payload||typeof payload!=='object'||!('data'in payload))throw new AmbulanceDriverApiError(response.status,'INVALID_RESPONSE','Invalid server response');return(payload as {data:T}).data}
const qs=(p:Record<string,unknown>)=>{const s=new URLSearchParams();Object.entries(p).forEach(([k,v])=>{if(v!==undefined&&v!=='')s.set(k,String(v))});const x=s.toString();return x?`?${x}`:''};
export interface DriverDutyStatus {
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  dutyState: 'OFF_DUTY' | 'AVAILABLE' | 'BUSY';
  updatedAt: string;
  accountStatus: string;
  licenseVerificationStatus: string;
  providerStatus: { accountStatus: string; verificationStatus: string } | null;
  assignedAmbulance: null | { id: string; registrationNumber: string; vehicleNumber: string; ambulanceType: string; status: string; accountStatus: string; verificationStatus: string };
  location: null | { latitude: number; longitude: number; accuracyMeters?: number; updatedAt?: string; freshness: 'FRESH' | 'STALE'; coordinatesAreLive: boolean };
  activeTrip: null | { id: string; status: string; emergencyRequestId: string; ambulanceId: string };
  trackingIntervalMs: number;
  staleAfterMs: number;
  canStartDuty: boolean;
  canEndDuty: boolean;
}
export interface DriverDutyLocationInput { latitude: number; longitude: number; accuracy: number; timestamp: number; }
export interface DispatchOffer {
  dispatchJobId: string;
  attemptId: string;
  deadlineAt: string;
  request?: { id: string; requestCode: string; situationType: string; category: string; pickup: { latitude: number; longitude: number; label: string } };
  hospital?: { id: string; name: string; address?: string; city?: string; phone?: string; latitude?: number; longitude?: number };
  route?: { source: 'DRIVING' | 'STRAIGHT_LINE_FALLBACK'; distanceMeters: number; etaSeconds?: number };
}
export interface DispatchOfferAcceptance {
  dispatchJobId: string;
  tripId: string;
  emergencyRequestId: string;
  hospitalId: string;
  requestCode: string;
  status: 'ACCEPTED';
  duplicate?: boolean;
  etaMinutes?: number;
  routeSource: 'DRIVING' | 'STRAIGHT_LINE_FALLBACK';
}
export const ambulanceDriverApi={
getProfile:()=>request<Driver>('/ambulance-driver/profile'),
updateProfile:(body:unknown)=>request<Driver>('/ambulance-driver/profile',{method:'PATCH',body:JSON.stringify(body)}),
getStatus:()=>request<DriverDutyStatus>('/ambulance-driver/duty'),
getDutyStatus:()=>request<DriverDutyStatus>('/ambulance-driver/duty'),
startDuty:(body:DriverDutyLocationInput)=>request<{status:'ONLINE';dutyState:'AVAILABLE';ambulanceId:string;locationUpdatedAt:string;trackingIntervalMs:number;staleAfterMs:number}>('/ambulance-driver/duty/start',{method:'POST',body:JSON.stringify(body)}),
endDuty:()=>request<{status:'OFFLINE';dutyState:'OFF_DUTY';alreadyOffDuty:boolean;updatedAt:string}>('/ambulance-driver/duty/end',{method:'POST'}),
updateLocation:(body:DriverDutyLocationInput)=>request<{ambulanceId:string;driverId:string;latitude:number;longitude:number;locationUpdatedAt:string;sourceTimestamp:string;freshness:'FRESH';coordinatesAreLive:boolean;accuracyMeters:number;dutyState:'AVAILABLE'|'BUSY'}>('/ambulance-driver/location',{method:'PATCH',body:JSON.stringify(body)}),
updateStatus:(status:string)=>request<DriverDutyStatus>('/ambulance-driver/status',{method:'PATCH',body:JSON.stringify({status})}),
getRequests:(p:Record<string,unknown>={})=>request<{items:AmbulanceRequest[];pagination:Pagination}>(`/ambulance-driver/requests${qs(p)}`),
getDispatchOffers:()=>request<DispatchOffer[]>('/ambulance-driver/dispatch-offers'),
acceptDispatchOffer:(id:string)=>request<DispatchOfferAcceptance>(`/ambulance-driver/dispatch-offers/${encodeURIComponent(id)}/accept`,{method:'POST'}),
rejectDispatchOffer:(id:string)=>request<{dispatchJobId:string;status:'REJECTED';reassignmentQueued:boolean}>(`/ambulance-driver/dispatch-offers/${encodeURIComponent(id)}/reject`,{method:'POST'}),
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
