export type HospitalAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'UNKNOWN';
export type HospitalEmergencyStatus = 'RECEIVED' | 'REVIEWING' | 'PREPARING' | 'AMBULANCE_COORDINATION' | 'RESOLVED' | 'CANCELLED';
export type HospitalPatientStatus = 'INCOMING' | 'HOSPITAL_NOTIFIED' | 'AT_HOSPITAL' | 'RESOLVED' | 'CANCELLED';

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
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  accountStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  publicContactInformation?: string;
  operationalDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HospitalPagination { page: number; limit: number; total: number; totalPages: number; }

export interface HospitalEmergency {
  id: string;
  requestCode: string;
  situationType: string;
  reportedAt: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  status: HospitalEmergencyStatus;
  ambulanceId?: string;
  patientId?: string;
  etaMinutes?: number;
  updatedAt: string;
}

export interface HospitalPatient {
  id: string;
  caseId: string;
  emergencyId?: string;
  ambulanceId?: string;
  coordinationStatus: HospitalPatientStatus;
  emergencyType: string;
  etaMinutes?: number;
  receivedAt: string;
  updatedAt: string;
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
  updatedAt: string;
}
