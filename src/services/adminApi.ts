import type { AdminAccountStatus, AdminAmbulance, AdminAmbulanceDriver, AdminAmbulanceProvider, AdminHospital, AdminList, AdminListParams, AdminOverview, AdminUser, AdminVerificationStatus } from '../types/adminManagement';

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5001/api/v1');

export class AdminApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); this.name = 'AdminApiError'; }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
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
  drivers: (params: AdminListParams) => request<AdminList<AdminAmbulanceDriver>>(`/admin/ambulance-drivers${query(params)}`),
  driver: (id: string) => request<AdminAmbulanceDriver>(`/admin/ambulance-drivers/${encodeURIComponent(id)}`),
  driverVerification: (id: string, verificationStatus: AdminVerificationStatus) => request<AdminAmbulanceDriver>(`/admin/ambulance-drivers/${encodeURIComponent(id)}/verification`, { method: 'PATCH', body: JSON.stringify({ verificationStatus }) }),
  driverStatus: (id: string, status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'>) => request<AdminAmbulanceDriver>(`/admin/ambulance-drivers/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
