export type HospitalAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'UNKNOWN';
export type HospitalEmergencyStatus = 'RECEIVED' | 'REVIEWING' | 'PREPARING' | 'AMBULANCE_COORDINATION' | 'RESOLVED' | 'CANCELLED' | 'REASSIGNMENT_REQUIRED';
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
  ambulanceProviderId?: string;
  driverId?: string;
  patientId?: string;
  etaMinutes?: number;
  createdAt: string;
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

export interface HospitalEmergencySummary {
  RECEIVED: number;
  REVIEWING: number;
  PREPARING: number;
  AMBULANCE_COORDINATION: number;
  RESOLVED: number;
  CANCELLED: number;
}

export type HospitalCoordinationNotificationType =
  | 'EMERGENCY_RECEIVED' | 'EMERGENCY_CANCELLED' | 'AMBULANCE_ASSIGNED' | 'AMBULANCE_REASSIGNED'
  | 'AMBULANCE_AT_PICKUP' | 'PATIENT_PICKED_UP' | 'EN_ROUTE_TO_HOSPITAL' | 'AMBULANCE_ARRIVED'
  | 'TRIP_COMPLETED' | 'TRIP_CANCELLED';
export type HospitalCoordinationNotificationState = 'UNREAD' | 'ACKNOWLEDGED' | 'SUPERSEDED';
export interface HospitalCoordinationNotification {
  id: string;
  hospitalId: string;
  emergencyId: string;
  tripId?: string;
  ambulanceId?: string;
  type: HospitalCoordinationNotificationType;
  state: HospitalCoordinationNotificationState;
  requestCode: string;
  emergencyCategory: string;
  tripStatus?: string;
  title: string;
  message: string;
  etaMinutes?: number;
  acknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
  deliveryAttemptCount: number;
  lastDeliveryAttemptAt?: string;
}
export interface HospitalCoordinationNotificationPage {
  items: HospitalCoordinationNotification[];
  unreadCount: number;
  pagination: HospitalPagination;
}
export interface HospitalCoordinationDetail {
  emergency: {
    id: string; requestCode: string; category: string; situationType: string; reportedAt: string;
    status: HospitalEmergencyStatus; pickup: { label?: string; latitude?: number; longitude?: number }; etaMinutes?: number;
  };
  patient: { caseId: string; coordinationStatus: HospitalPatientStatus; receivedAt: string; etaMinutes?: number } | null;
  trip: null | {
    id: string; status: string; acceptedAt?: string; arrivedAtPickupAt?: string; patientPickedUpAt?: string;
    arrivedAtHospitalAt?: string; completedAt?: string; createdAt: string; updatedAt: string;
    history: Array<{ status: string; changedAt: string; actorRole: string; previousStatus?: string }>;
  };
  ambulance: null | {
    id: string; registrationNumber: string; vehicleNumber: string; ambulanceType: string; currentStatus: string;
    location: null | { latitude: number; longitude: number; accuracyMeters?: number; updatedAt?: string; ageMs?: number; freshness: 'FRESH' | 'STALE'; coordinatesAreLive: boolean };
  };
  allowedActions: HospitalEmergencyStatus[];
  freshnessThresholdMs: number;
}
