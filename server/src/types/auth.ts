import type { Request } from 'express';
import type { AccountStatus, Role, VerificationStatus } from './roles.js';
export type SocialProvider='GOOGLE'|'MICROSOFT';
export interface AuthenticatedIdentity { id:string; email:string; name?:string; role:Role; accountStatus:AccountStatus; verificationStatus?:VerificationStatus; profileCompletionStatus?:'INCOMPLETE'|'COMPLETE'; licenseVerificationStatus?:VerificationStatus; }
export interface AuthenticatedRequest extends Request { auth?:AuthenticatedIdentity; }
export interface JwtClaims { sub:string; email:string; name?:string; role:Role; accountStatus:AccountStatus; type:'access'|'refresh'; verificationStatus?:VerificationStatus; profileCompletionStatus?:'INCOMPLETE'|'COMPLETE'; licenseVerificationStatus?:VerificationStatus; jti?:string; }
