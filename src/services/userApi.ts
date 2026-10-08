import type { Facility } from '../types/facility';

const API_BASE=(()=>{const value=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.trim();if(!value)throw new Error('VITE_API_BASE_URL is required.');return value.replace(/\/$/,'');})();

class UserApiError extends Error { readonly status:number; readonly code:string; constructor(status:number,code:string,message:string){super(message);this.name='UserApiError';this.status=status;this.code=code;} }
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(API_BASE+path,{...init,credentials:'include',headers:{'Content-Type':'application/json',...(init.headers??{})}});
  const payload:unknown=await response.json().catch(()=>null);
  if(!response.ok){const error=payload&&typeof payload==='object'&&'error' in payload?(payload as {error?:{code?:string;message?:string}}).error:undefined;throw new UserApiError(response.status,error?.code??'REQUEST_FAILED',error?.message??'The request could not be completed.');}
  if(!payload||typeof payload!=='object'||!('data' in payload))throw new UserApiError(response.status,'INVALID_RESPONSE','The server returned an invalid response.');
  return (payload as {data:T}).data;
}
export interface UserProfile { id:string;name:string;email:string;phone?:string;address?:string;city?:string;state?:string;country?:string;latitude?:number;longitude?:number;createdAt:string;updatedAt:string; }
export interface SavedFacility { id:string;name:string;hospitalType:string;services:string[];capabilities:string[];emergencyAvailability:string;address?:string;city?:string;state?:string;country?:string;phone:string;updatedAt:string;latitude?:number;longitude?:number; }
export const userApi={
  profile:()=>request<UserProfile>('/users/profile'),
  updateProfile:(input:Partial<Pick<UserProfile,'name'|'phone'|'address'|'city'|'state'|'country'|'latitude'|'longitude'>>)=>request<UserProfile>('/users/profile',{method:'PATCH',body:JSON.stringify(input)}),
  savedFacilities:()=>request<{items:SavedFacility[]}>('/users/saved-facilities'),
  saveFacility:(facilityId:string)=>request<{saved:boolean;facilityId:string}>(`/users/saved-facilities/${encodeURIComponent(facilityId)}`,{method:'POST',body:'{}'}),
  removeSavedFacility:(facilityId:string)=>request<{saved:boolean;facilityId:string}>(`/users/saved-facilities/${encodeURIComponent(facilityId)}`,{method:'DELETE'}),
};
