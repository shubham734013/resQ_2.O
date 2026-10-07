import type { HospitalEmergencyStatus } from './hospitalManagement';

export interface ReportDateRange { from: string | null; to: string | null; }
export interface ReportOverview {
  generatedAt: string;
  range: ReportDateRange;
  emergencies: { totalRequests:number; activeRequests:number; received:number; resolved:number; cancelled:number };
  hospitals: { total:number; verified:number };
  ambulanceProviders: { total:number; verified:number };
  ambulances: { total:number; available:number; busy:number; offline:number; maintenance:number; unassigned:number };
  drivers: { total:number; online:number; busy:number; offline:number };
}
export interface ReportTrendPoint { _id:string; value:number; }
export interface ReportValuePoint { _id:string; value:number; }
export interface ReportHospitalPoint { id:string; name:string; value:number; }
export interface EmergencyReports { trend:ReportTrendPoint[]; status:ReportValuePoint[]; situations:ReportValuePoint[]; hospitals:ReportHospitalPoint[]; }
export interface OperationalAnalytics {
  resolutionRatio:number|null;
  responseToReview:{ averageMinutes:number|null; samples:number };
  ambulanceStatus:Array<{label:string; value:number}>;
  providerFleet:Array<{id:string; label:string; value:number}>;
  hospitalActivity:Array<{id:string; label:string; value:number}>;
}
export interface ReportExportRow { _id:string; total:number; RECEIVED:number; REVIEWING:number; PREPARING:number; AMBULANCE_COORDINATION:number; RESOLVED:number; CANCELLED:number; }
export type ReportStatus = HospitalEmergencyStatus;
