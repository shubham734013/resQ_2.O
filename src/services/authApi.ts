import type {
  AmbulanceDriverRegistrationRequest, AmbulanceProviderRegistrationRequest, ApiErrorBody, AuthResponse,
  AuthUser, CurrentUserResponse, HospitalRegistrationRequest, LoginRequest, SocialAuthRequest, UserRegistrationRequest,
} from '../types/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5001/api/v1';

export class AuthApiError extends Error {
  readonly status:number; readonly code:string;
  constructor(status:number,code:string,message:string){super(message);this.name='AuthApiError';this.status=status;this.code=code;}
}
const isApiErrorBody=(value:unknown):value is ApiErrorBody=>{if(!value||typeof value!=='object')return false;const body=value as Record<string,unknown>;const error=body.error;if(!error||typeof error!=='object')return false;const e=error as Record<string,unknown>;return body.success===false&&typeof e.code==='string'&&typeof e.message==='string';};
const parseResponse=async<T>(response:Response):Promise<T>=>{const type=response.headers.get('content-type')??'';const body:unknown=type.includes('application/json')?await response.json():null;if(!response.ok){if(isApiErrorBody(body))throw new AuthApiError(response.status,body.error.code,body.error.message);throw new AuthApiError(response.status,'REQUEST_FAILED','The request could not be completed.');}return body as T;};
const request=async<T>(path:string,init:RequestInit={}):Promise<T>=>{const response=await fetch(`${API_BASE_URL}${path}`,{...init,credentials:'include',headers:{'Content-Type':'application/json',...(init.headers??{})}});return parseResponse<T>(response);};
const postJson=<T>(path:string,body:unknown):Promise<T>=>request<T>(path,{method:'POST',body:JSON.stringify(body)});
export const authApi={
 login:(input:LoginRequest):Promise<AuthResponse>=>postJson('/auth/login',input),
 adminLogin:(input:LoginRequest):Promise<AuthResponse>=>postJson('/auth/admin/login',input),
 registerUser:(input:UserRegistrationRequest):Promise<{success:true;data:AuthUser}>=>postJson('/auth/register/user',input),
 registerHospital:(input:HospitalRegistrationRequest):Promise<{success:true;data:AuthUser}>=>postJson('/auth/register/hospital',input),
 registerAmbulanceProvider:(input:AmbulanceProviderRegistrationRequest):Promise<{success:true;data:AuthUser}>=>postJson('/auth/register/ambulance-provider',input),
 registerAmbulanceDriver:(input:AmbulanceDriverRegistrationRequest):Promise<{success:true;data:AuthUser}>=>postJson('/auth/register/ambulance-driver',input),
 socialLogin:(provider:'google'|'microsoft',input:SocialAuthRequest):Promise<AuthResponse>=>postJson(`/auth/${provider}`,input),
 linkSocial:(provider:'google'|'microsoft',input:SocialAuthRequest):Promise<{success:true;data:AuthUser}>=>postJson(`/auth/link/${provider}`,input),
 me:():Promise<CurrentUserResponse>=>request('/auth/me'),
 logout:():Promise<{success:true;data:{loggedOut:boolean}}>=>postJson('/auth/logout',{}),
 refresh:():Promise<AuthResponse>=>postJson('/auth/refresh',{}),
};
export const getAuthApiBaseUrl=():string=>API_BASE_URL;