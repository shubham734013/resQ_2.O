import type { AdminAccountStatus, AdminAmbulance, AdminAmbulanceDriver, AdminAmbulanceProvider, AdminHospital, AdminList, AdminListParams, AdminOverview, AdminUser, AdminVerificationStatus } from '../types/adminManagement';
import type { EmergencyReports, OperationalAnalytics, ReportOverview } from '../types/adminReports';
export interface AdminEmergencyListItem { id:string; requestCode:string; userId:string; patientId?:string; situationType:string; reportedAt:string; status:string; statusHistory:Array<{status:string;changedAt:string;actorId?:string;actorRole:string;previousStatus?:string}>; hospital:{id:string;name?:string;latitude?:number;longitude?:number}|null; ambulanceProvider:{id:string;name?:string}|null; ambulance:{id:string;registrationNumber?:string;vehicleNumber?:string;latitude?:number;longitude?:number;locationUpdatedAt?:string}|null; driver:{id:string;name?:string}|null; pickup:{latitude?:number;longitude?:number;label?:string}; etaMinutes?:number; createdAt:string; updatedAt:string; }

const API_BASE_URL = (() => { const value = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim(); if (!value) throw new Error('VITE_API_BASE_URL is required.'); return value.replace(/\/$/, ''); })();

export class AdminApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'AdminApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? (payload as { error?: { code?: string; message?: string } }).error : undefined;
    throw new AdminApiError(response.status, error?.code ?? 'REQUEST_FAILED', error?.message ?? userFacingMessage(response.status));
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new AdminApiError(response.status, 'INVALID_RESPONSE', 'The server returned an invalid response.');
  return (payload as { data: T }).data;
}


function userFacingMessage(status: number): string {
  if (status === 401) return 'Your admin session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to perform this operation.';
  if (status === 404) return 'The requested admin record was not found.';
  if (status === 409) return 'The operation conflicts with the current record state.';
  if (status === 422) return 'Some submitted values are invalid.';
  if (status >= 500) return 'The server could not complete the request. Please try again.';
  return 'The request could not be completed.';
}

function query(params: AdminListParams): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') search.set(key, String(value)); });
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export const adminApi = {
  overview: () => request<AdminOverview>('/admin/overview'),
  users: (params: AdminListParams) => request<AdminList<AdminUser>>(`/admin/users${query(params)}`),
  user: (id: string) => request<AdminUser>(`/admin/users/${encodeURIComponent(id)}`),
  userStatus: (id: string, status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'>) => request<AdminUser>(`/admin/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  hospitals: (params: AdminListParams) => request<AdminList<AdminHospital>>(`/admin/hospitals${query(params)}`),
  hospital: (id: string) => request<AdminHospital>(`/admin/hospitals/${encodeURIComponent(id)}`),
  hospitalVerification: (id: string, verificationStatus: AdminVerificationStatus) => request<AdminHospital>(`/admin/hospitals/${encodeURIComponent(id)}/verification`, { method: 'PATCH', body: JSON.stringify({ verificationStatus }) }),
  hospitalStatus: (id: string, status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'>) => request<AdminHospital>(`/admin/hospitals/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  providers: (params: AdminListParams) => request<AdminList<AdminAmbulanceProvider>>(`/admin/ambulance-providers${query(params)}`),
  provider: (id: string) => request<AdminAmbulanceProvider>(`/admin/ambulance-providers/${encodeURIComponent(id)}`),
  providerVerification: (id: string, verificationStatus: AdminVerificationStatus) => request<AdminAmbulanceProvider>(`/admin/ambulance-providers/${encodeURIComponent(id)}/verification`, { method: 'PATCH', body: JSON.stringify({ verificationStatus }) }),
  providerStatus: (id: string, status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'>) => request<AdminAmbulanceProvider>(`/admin/ambulance-providers/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  ambulances: (params: AdminListParams) => request<AdminList<AdminAmbulance>>(`/admin/ambulances${query(params)}`),
  ambulance: (id: string) => request<AdminAmbulance>(`/admin/ambulances/${encodeURIComponent(id)}`),
  ambulanceVerification: (id:string, verificationStatus:AdminVerificationStatus) => request<AdminAmbulance>(`/admin/ambulances/${encodeURIComponent(id)}/verification`, {method:'PATCH',body:JSON.stringify({verificationStatus})}),
  ambulanceStatus: (id:string, status:Extract<AdminAccountStatus,'ACTIVE'|'SUSPENDED'|'REJECTED'>) => request<AdminAmbulance>(`/admin/ambulances/${encodeURIComponent(id)}/status`, {method:'PATCH',body:JSON.stringify({status})}),
  drivers: (params: AdminListParams) => request<AdminList<AdminAmbulanceDriver>>(`/admin/ambulance-drivers${query(params)}`),
  driver: (id: string) => request<AdminAmbulanceDriver>(`/admin/ambulance-drivers/${encodeURIComponent(id)}`),
  driverVerification: (id: string, verificationStatus: AdminVerificationStatus) => request<AdminAmbulanceDriver>(`/admin/ambulance-drivers/${encodeURIComponent(id)}/verification`, { method: 'PATCH', body: JSON.stringify({ verificationStatus }) }),
  driverStatus: (id: string, status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'>) => request<AdminAmbulanceDriver>(`/admin/ambulance-drivers/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  emergencies: (params: Omit<AdminListParams, 'status'> & { status?: string; hospital?: string; provider?: string; ambulance?: string; driver?: string; situation?: string }) => request<AdminList<AdminEmergencyListItem>>(`/admin/emergencies${query(params as unknown as AdminListParams)}`),
  emergency: (id:string) => request<AdminEmergencyListItem>(`/admin/emergencies/${encodeURIComponent(id)}`),
  emergencySummary: () => request<Record<string,number>>('/admin/emergencies/summary'),
  reportsOverview: (params: { from?: string; to?: string }) => request<ReportOverview>(`/admin/reports/overview${query(params)}`),
  reportsEmergencies: (params: { from?: string; to?: string }) => request<EmergencyReports>(`/admin/reports/emergencies${query(params)}`),
  reportsAnalytics: (params: { from?: string; to?: string }) => request<OperationalAnalytics>(`/admin/reports/analytics${query(params)}`),
  exportReports: async (params: { from?: string; to?: string }) => {
    const response = await fetch(`${API_BASE_URL}/admin/reports/export${query(params)}`, { credentials: 'include' });
    if (!response.ok) throw new AdminApiError(response.status, 'EXPORT_FAILED', 'The report export could not be generated.');
    return response.blob();
  },
};
