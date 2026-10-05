import type { AdminAmbulance, AdminEmergency, AdminHospital, AdminMetric, AdminReport, AdminUser, CategoryValue, DemandArea, TrendPoint } from '../types/admin';

export const ADMIN_METRICS: AdminMetric[] = [
  { label: 'Total Emergency Requests', value: '1,284', detail: 'Last 30 days', trend: '+6.4%' },
  { label: 'Active Emergencies', value: '7', detail: 'Currently monitored' },
  { label: 'Verified Hospitals', value: '42', detail: 'Network facilities' },
  { label: 'Active Ambulances', value: '68', detail: 'Currently online' },
  { label: 'Average Response Time', value: '8m 42s', detail: 'Last 7 days', trend: '-38s' },
  { label: 'Successful Coordinations', value: '96.8%', detail: 'Last 30 days', trend: '+1.2%' },
];

export const ADMIN_EMERGENCIES: AdminEmergency[] = [
  { id: 'RQ-1024', category: 'Accident / Injury', hospital: 'CityCare', ambulance: 'RX-12', eta: '8 min', status: 'En Route', area: 'Vaishali Nagar' },
  { id: 'RQ-1025', category: 'Breathing Difficulty', hospital: 'Fortis', ambulance: 'RX-07', eta: '12 min', status: 'Hospital Notified', area: 'Malviya Nagar' },
  { id: 'RQ-1026', category: 'Cardiac Symptoms', hospital: 'SMS Hospital', ambulance: 'RX-19', eta: '5 min', status: 'At Patient', area: 'C-Scheme' },
  { id: 'RQ-1027', category: 'Fall / Injury', hospital: 'Metro Hospital', ambulance: 'RX-03', eta: '14 min', status: 'Dispatching', area: 'Mansarovar' },
  { id: 'RQ-1028', category: 'Medical Emergency', hospital: 'EHCC', ambulance: 'RX-21', eta: '9 min', status: 'En Route', area: 'Jagatpura' },
];

export const ADMIN_HOSPITALS: AdminHospital[] = [
  { id: 'H-001', name: 'CityCare Hospital', verification: 'Verified', emergencyStatus: 'Operational', lastUpdated: '2 min ago', area: 'Vaishali Nagar', availability: 'ER: Open · 8 beds', accountStatus: 'Active' },
  { id: 'H-002', name: 'Fortis Jaipur', verification: 'Verified', emergencyStatus: 'Operational', lastUpdated: '5 min ago', area: 'Malviya Nagar', availability: 'ER: Open · 5 beds', accountStatus: 'Active' },
  { id: 'H-003', name: 'Metro Hospital', verification: 'Pending', emergencyStatus: 'Limited', lastUpdated: '18 min ago', area: 'Mansarovar', availability: 'ER: Limited · 2 beds', accountStatus: 'Active' },
  { id: 'H-004', name: 'Community Care Centre', verification: 'Suspended', emergencyStatus: 'Unavailable', lastUpdated: '1 hr ago', area: 'Sanganer', availability: 'ER: Closed', accountStatus: 'Suspended' },
];

export const ADMIN_AMBULANCES: AdminAmbulance[] = [
  { id: 'RX-12', operator: 'ResQ Fleet A', online: true, status: 'En Route', assignment: 'RQ-1024 · Patient pickup', eta: '8 min', lastUpdate: '30 sec ago' },
  { id: 'RX-07', operator: 'ResQ Fleet A', online: true, status: 'At Hospital', assignment: 'RQ-1025 · Fortis', eta: '12 min', lastUpdate: '1 min ago' },
  { id: 'RX-19', operator: 'ResQ Fleet B', online: true, status: 'At Patient', assignment: 'RQ-1026 · C-Scheme', eta: '5 min', lastUpdate: '45 sec ago' },
  { id: 'RX-03', operator: 'ResQ Fleet B', online: true, status: 'Available', assignment: 'Unassigned', eta: '—', lastUpdate: '2 min ago' },
  { id: 'RX-21', operator: 'ResQ Fleet C', online: false, status: 'Offline', assignment: 'Unassigned', eta: '—', lastUpdate: '26 min ago' },
];

export const ADMIN_USERS: AdminUser[] = [
  { id: 'USR-1842', accountStatus: 'Active', emergencyRequests: 2, createdDate: '12 Sep 2026', status: 'Normal' },
  { id: 'USR-2910', accountStatus: 'Active', emergencyRequests: 1, createdDate: '28 Aug 2026', status: 'Normal' },
  { id: 'USR-4418', accountStatus: 'Restricted', emergencyRequests: 4, createdDate: '03 Jul 2026', status: 'Review required' },
  { id: 'USR-5082', accountStatus: 'Active', emergencyRequests: 0, createdDate: '18 Jun 2026', status: 'Normal' },
];

export const ADMIN_REPORTS: AdminReport[] = [
  { id: 'RP-0901', category: 'Incorrect facility information', priority: 'High', status: 'Investigating', createdTime: '12 min ago' },
  { id: 'RP-0902', category: 'Outdated availability', priority: 'Medium', status: 'Open', createdTime: '34 min ago' },
  { id: 'RP-0903', category: 'Incorrect location', priority: 'Medium', status: 'Resolved', createdTime: '1 hr ago' },
  { id: 'RP-0904', category: 'Emergency status issue', priority: 'High', status: 'Open', createdTime: '2 hrs ago' },
  { id: 'RP-0905', category: 'Ambulance issue', priority: 'Low', status: 'Investigating', createdTime: '3 hrs ago' },
];

export const REQUEST_TREND: TrendPoint[] = [
  { label: 'Mon', value: 38 }, { label: 'Tue', value: 44 }, { label: 'Wed', value: 41 }, { label: 'Thu', value: 52 }, { label: 'Fri', value: 48 }, { label: 'Sat', value: 61 }, { label: 'Sun', value: 55 },
];
export const RESPONSE_TREND: TrendPoint[] = [
  { label: 'Week 1', value: 10.1 }, { label: 'Week 2', value: 9.4 }, { label: 'Week 3', value: 8.9 }, { label: 'Week 4', value: 8.7 },
];
export const EMERGENCY_CATEGORIES: CategoryValue[] = [
  { label: 'Injury / Accident', value: 31 }, { label: 'Medical', value: 27 }, { label: 'Breathing', value: 18 }, { label: 'Cardiac', value: 14 }, { label: 'Other', value: 10 },
];
export const DEMAND_AREAS: DemandArea[] = [
  { label: 'Vaishali Nagar', requests: 42, level: 'High', latitude: 26.911, longitude: 75.739 },
  { label: 'Malviya Nagar', requests: 36, level: 'High', latitude: 26.850, longitude: 75.805 },
  { label: 'Mansarovar', requests: 29, level: 'Medium', latitude: 26.856, longitude: 75.764 },
  { label: 'C-Scheme', requests: 23, level: 'Medium', latitude: 26.912, longitude: 75.792 },
  { label: 'Jagatpura', requests: 17, level: 'Low', latitude: 26.839, longitude: 75.837 },
];

export const ADMIN_LAST_UPDATED = 'Prototype data · updated for demo';
