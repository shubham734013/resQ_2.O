export type HospitalVerification = 'Verified' | 'Pending';
export type HospitalOperationalStatus = 'Available' | 'Limited' | 'Unavailable';
export type EmergencyRequestStatus = 'Pending' | 'Accepted' | 'Declined';
export type AmbulanceOperationalStatus = 'En Route' | 'At Patient' | 'Available' | 'Offline';

export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  emergencyContact: string;
  verification: HospitalVerification;
  emergencyDepartment: HospitalOperationalStatus;
}
export interface EmergencyRequest {
  id: string;
  category: string;
  approximateLocation: string;
  eta: string;
  requiredCapability: string;
  ambulanceStatus: AmbulanceOperationalStatus;
  status: EmergencyRequestStatus;
}
export interface PatientCase { id: string; emergencyType: string; eta: string; ambulance: string; status: string; }
export interface HospitalAmbulance { id: string; status: AmbulanceOperationalStatus; eta: string; currentTrip: string; destination: string; }
export interface HospitalResource { id: string; name: string; available: number; total: number; status: HospitalOperationalStatus; }
