import type { AccountStatus, VerificationStatus } from './roles.js';
import type { HospitalEmergencyStatus } from '../models/EmergencyRequest.js';
import type { HospitalPatientStatus } from '../models/HospitalPatient.js';

export interface HospitalProfile {
  id: string;
  name: string;
  registrationNumber: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  hospitalType: string;
  services: string[];
  capabilities: string[];
  resourceSummary: Record<string, number>;
  emergencyAvailability: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  publicContactInformation?: string;
  operationalDescription?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface HospitalPagination { page: number; limit: number; total: number; totalPages: number; }

export interface HospitalEmergency {
  id: string;
  requestCode: string;
  situationType: string;
  reportedAt: Date | string;
  location?: string;
  latitude?: number;
  longitude?: number;
  status: HospitalEmergencyStatus;
  ambulanceId?: string;
  ambulanceProviderId?: string;
  driverId?: string;
  patientId?: string;
  etaMinutes?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface HospitalPatient {
  id: string;
  caseId: string;
  emergencyId?: string;
  ambulanceId?: string;
  coordinationStatus: HospitalPatientStatus;
  emergencyType: string;
  etaMinutes?: number;
  receivedAt: Date | string;
  updatedAt: Date | string;
}

export interface HospitalAmbulance {
  id: string;
  registrationNumber: string;
  vehicleNumber: string;
  ambulanceType: string;
  capabilities: string[];
  currentStatus: string;
  currentLatitude?: number;
  currentLongitude?: number;
  serviceArea?: string;
  provider?: { id: string; name?: string; registrationNumber?: string } | null;
  driver?: { id: string; name?: string; licenseNumber?: string } | null;
  emergencyId?: string;
  etaMinutes?: number;
  updatedAt: Date | string;
}
