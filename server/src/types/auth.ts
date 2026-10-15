import type { Request } from 'express';
import type { AccountStatus, Role, VerificationStatus } from './roles.js';
export type SocialProvider='GOOGLE'|'MICROSOFT';
export interface AuthenticatedIdentity {
  id: string;
  email: string;
  name?: string;
  role: Role;
  accountStatus: AccountStatus;
  phone?: string;
  verificationStatus?: VerificationStatus;
  profileCompletionStatus?: 'INCOMPLETE' | 'COMPLETE';
  licenseVerificationStatus?: VerificationStatus;
  providerId?: string;
  providerName?: string;
  assignedAmbulanceId?: string;
  assignedAmbulanceVehicleNumber?: string;
  licenseNumber?: string;
  availabilityStatus?: string;
  registrationNumber?: string;
  hospitalType?: string;
  serviceType?: string;
}
export interface AuthenticatedRequest extends Request { auth?: AuthenticatedIdentity; }
export interface JwtClaims {
  sub: string;
  email: string;
  name?: string;
  role: Role;
  accountStatus: AccountStatus;
  type: 'access' | 'refresh';
  phone?: string;
  verificationStatus?: VerificationStatus;
  profileCompletionStatus?: 'INCOMPLETE' | 'COMPLETE';
  licenseVerificationStatus?: VerificationStatus;
  providerId?: string;
  providerName?: string;
  assignedAmbulanceId?: string;
  assignedAmbulanceVehicleNumber?: string;
  licenseNumber?: string;
  availabilityStatus?: string;
  registrationNumber?: string;
  hospitalType?: string;
  serviceType?: string;
  jti?: string;
}
