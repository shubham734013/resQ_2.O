export type VerificationStatus = 'Verified' | 'Pending' | 'Suspended';
export type OperationalStatus = 'Operational' | 'Limited' | 'Unavailable';
export type AmbulanceStatus = 'Available' | 'En Route' | 'At Patient' | 'At Hospital' | 'Offline';
export type AccountStatus = 'Active' | 'Restricted' | 'Suspended';
export type ReportPriority = 'High' | 'Medium' | 'Low';
export type ReportStatus = 'Open' | 'Investigating' | 'Resolved';

export interface AdminMetric { label: string; value: string; detail: string; trend?: string; }
export interface AdminEmergency { id: string; category: string; hospital: string; ambulance: string; eta: string; status: string; area: string; }
export interface AdminHospital { id: string; name: string; verification: VerificationStatus; emergencyStatus: OperationalStatus; lastUpdated: string; area: string; availability: string; accountStatus: AccountStatus; }
export interface AdminAmbulance { id: string; operator: string; online: boolean; status: AmbulanceStatus; assignment: string; eta: string; lastUpdate: string; }
export interface AdminUser { id: string; accountStatus: AccountStatus; emergencyRequests: number; createdDate: string; status: string; }
export interface AdminReport { id: string; category: string; priority: ReportPriority; status: ReportStatus; createdTime: string; }
export interface TrendPoint { label: string; value: number; }
export interface CategoryValue { label: string; value: number; }
export interface DemandArea { label: string; requests: number; level: 'High' | 'Medium' | 'Low'; latitude: number; longitude: number; }
