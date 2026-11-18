import type { EmergencyRequest, Hospital, HospitalAmbulance, HospitalResource, PatientCase } from '../types/hospital';

export const MOCK_HOSPITAL: Hospital = {
  id: 'hospital-citycare', name: 'CityCare Emergency Hospital', address: 'C-Scheme, Jaipur', phone: '+91 141 400 2200', emergencyContact: '+91 141 400 2299', verification: 'Verified', emergencyDepartment: 'Available',
};

export const MOCK_EMERGENCIES: EmergencyRequest[] = [
  { id: 'RQ-1024', category: 'Accident / Injury', approximateLocation: 'Tonk Road area', eta: '8 min', requiredCapability: 'Trauma', ambulanceStatus: 'En Route', status: 'Pending' },
  { id: 'RQ-1025', category: 'Breathing Difficulty', approximateLocation: 'Malviya Nagar area', eta: '12 min', requiredCapability: 'ICU support', ambulanceStatus: 'En Route', status: 'Pending' },
  { id: 'RQ-1026', category: 'Cardiac Emergency', approximateLocation: 'Vaishali Nagar area', eta: '6 min', requiredCapability: 'Cardiac care', ambulanceStatus: 'At Patient', status: 'Accepted' },
];

export const MOCK_PATIENTS: PatientCase[] = [
  { id: 'CASE-201', emergencyType: 'Accident / Injury', eta: '8 min', ambulance: 'RX-12', status: 'Incoming' },
  { id: 'CASE-202', emergencyType: 'Breathing Difficulty', eta: '12 min', ambulance: 'RX-07', status: 'Hospital Notified' },
  { id: 'CASE-203', emergencyType: 'Cardiac Emergency', eta: 'Arriving', ambulance: 'RX-04', status: 'At Patient' },
];

export const MOCK_AMBULANCES: HospitalAmbulance[] = [
  { id: 'RX-12', status: 'En Route', eta: '8 min', currentTrip: 'Patient pickup', destination: MOCK_HOSPITAL.name },
  { id: 'RX-07', status: 'En Route', eta: '12 min', currentTrip: 'Patient pickup', destination: MOCK_HOSPITAL.name },
  { id: 'RX-04', status: 'At Patient', eta: 'Arriving', currentTrip: 'Patient transport', destination: MOCK_HOSPITAL.name },
  { id: 'RX-18', status: 'Available', eta: '—', currentTrip: 'None', destination: 'Standby' },
];

export const MOCK_RESOURCES: HospitalResource[] = [
  { id: 'emergency-beds', name: 'Emergency Beds', available: 12, total: 20, status: 'Available' },
  { id: 'icu', name: 'ICU', available: 7, total: 12, status: 'Available' },
  { id: 'trauma', name: 'Trauma', available: 3, total: 5, status: 'Limited' },
  { id: 'ventilators', name: 'Ventilators', available: 8, total: 10, status: 'Available' },
  { id: 'or', name: 'Operating Rooms', available: 2, total: 4, status: 'Limited' },
];
