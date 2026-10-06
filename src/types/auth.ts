export type UserRole='USER'|'HOSPITAL'|'AMBULANCE_PROVIDER'|'AMBULANCE_DRIVER'|'ADMIN';
export type AccountStatus='PENDING'|'ACTIVE'|'SUSPENDED'|'REJECTED';
export type VerificationStatus='PENDING'|'VERIFIED'|'REJECTED';
export type SocialProvider='GOOGLE'|'MICROSOFT';
export interface AuthUser { id:string; email:string; name?:string; role:UserRole; accountStatus:AccountStatus; verificationStatus?:VerificationStatus; profileCompletionStatus?:'INCOMPLETE'|'COMPLETE'; licenseVerificationStatus?:VerificationStatus; }
export interface AuthResponse { success:true; data:{user:AuthUser}; }
export interface CurrentUserResponse { success:true; data:AuthUser; }
export interface LoginRequest { email:string; password:string; }
export interface SocialAuthRequest { credential:string; roleHint?:'USER'|'AMBULANCE_PROVIDER'; }
export interface UserRegistrationRequest extends LoginRequest { name:string; phone:string; address?:string; city?:string; state?:string; country?:string; latitude?:number; longitude?:number; }
export interface HospitalRegistrationRequest extends LoginRequest { name:string; phone:string; registrationNumber:string; hospitalType:string; services:string[]; capabilities:string[]; address?:string; city?:string; state?:string; country?:string; latitude?:number; longitude?:number; }
export interface AmbulanceProviderRegistrationRequest extends LoginRequest { name:string; phone:string; registrationNumber:string; serviceType:string; address?:string; city?:string; state?:string; country?:string; latitude?:number; longitude?:number; }
export interface AmbulanceDriverRegistrationRequest extends LoginRequest { fullName:string; phone:string; licenseNumber:string; providerId:string; assignedAmbulanceId?:string; address?:string; city?:string; state?:string; country?:string; registeredLatitude?:number; registeredLongitude?:number; }
export interface DriverProfileRequest { fullName:string; phone:string; licenseNumber:string; address:string; city:string; state:string; country:string; registeredLatitude:number; registeredLongitude:number; }
export interface ProviderProfileRequest { name:string; phone:string; registrationNumber:string; serviceType:string; address:string; city:string; state:string; country:string; latitude:number; longitude:number; }
export interface AuthState { user:AuthUser|null; isAuthenticated:boolean; isLoading:boolean; }
export interface ApiErrorBody { success:false; error:{code:string;message:string;details?:unknown}; }