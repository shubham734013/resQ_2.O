import type {
  HospitalAmbulance,
  HospitalEmergency,
  HospitalPatient,
  HospitalProfile,
  HospitalPagination,
} from '../types/hospitalManagement';

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5001/api/v1');

export class HospitalApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'HospitalApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload
      ? (payload as { error?: { code?: string; message?: string } }).error
      : undefined;
    throw new HospitalApiError(response.status, error?.code ?? 'REQUEST_FAILED', error?.message ?? 'The hospital request could not be completed.');
  }

  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new HospitalApiError(response.status, 'INVALID_RESPONSE', 'The server returned an invalid response.');
  }
  return (payload as { data: T }).data;
}

const query = (params: HospitalListParams): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
};

export type HospitalProfileUpdate = Partial<Pick<HospitalProfile, 'name' | 'phone' | 'address' | 'city' | 'state' | 'country' | 'latitude' | 'longitude' | 'hospitalType' | 'publicContactInformation' | 'emergencyAvailability' | 'operationalDescription'>>;

export interface HospitalListParams {
  page?: number;
  limit?: number;
  status?: string;
  from?: string;
  to?: string;
  situationType?: string;
  provider?: string;
  sortOrder?: 'asc' | 'desc';
}

export const hospitalApi = {
  getProfile: () => request<HospitalProfile>('/hospital/profile'),
  updateProfile: (input: HospitalProfileUpdate) =>
    request<HospitalProfile>('/hospital/profile', { method: 'PATCH', body: JSON.stringify(input) }),

  getServices: () => request<{ services: string[]; updatedAt: string }>('/hospital/services'),
  updateServices: (services: string[]) => request<{ services: string[]; updatedAt: string }>('/hospital/services', { method: 'PATCH', body: JSON.stringify({ services }) }),

  getCapabilities: () => request<{ capabilities: string[]; updatedAt: string }>('/hospital/capabilities'),
  updateCapabilities: (capabilities: string[]) => request<{ capabilities: string[]; updatedAt: string }>('/hospital/capabilities', { method: 'PATCH', body: JSON.stringify({ capabilities }) }),

  getAvailability: () => request<{ emergencyAvailability: string; updatedAt: string }>('/hospital/availability'),
  updateAvailability: (emergencyAvailability: string) => request<{ emergencyAvailability: string; updatedAt: string }>('/hospital/availability', { method: 'PATCH', body: JSON.stringify({ emergencyAvailability }) }),

  getResources: () => request<{ resourceSummary: Record<string, number>; updatedAt: string }>('/hospital/resources'),
  updateResources: (resourceSummary: Record<string, number>) => request<{ resourceSummary: Record<string, number>; updatedAt: string }>('/hospital/resources', { method: 'PATCH', body: JSON.stringify({ resourceSummary }) }),

  getEmergencies: (params: HospitalListParams = {}) =>
    request<{ items: HospitalEmergency[]; pagination: HospitalPagination }>(`/hospital/emergencies${query(params)}`),
  getEmergency: (id: string) => request<HospitalEmergency>(`/hospital/emergencies/${encodeURIComponent(id)}`),
  updateEmergencyStatus: (id: string, status: HospitalEmergency['status']) =>
    request<HospitalEmergency>(`/hospital/emergencies/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getPatients: (params: HospitalListParams = {}) =>
    request<{ items: HospitalPatient[]; pagination: HospitalPagination }>(`/hospital/patients${query(params)}`),
  getPatient: (id: string) => request<HospitalPatient>(`/hospital/patients/${encodeURIComponent(id)}`),

  getAmbulances: (params: HospitalListParams = {}) =>
    request<{ items: HospitalAmbulance[]; pagination: HospitalPagination }>(`/hospital/ambulances${query(params)}`),
  getAmbulance: (id: string) => request<HospitalAmbulance>(`/hospital/ambulances/${encodeURIComponent(id)}`),
};
