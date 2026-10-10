import type { CreateEmergencyRequest, EmergencyRequestView, EmergencySituationId } from '../types/emergency';

const API_BASE_URL = (() => { const value = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim(); if (!value) throw new Error('VITE_API_BASE_URL is required.'); return value.replace(/\/$/, ''); })();

export class EmergencyApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'EmergencyApiError';
    this.status = status;
    this.code = code;
  }
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(API_BASE_URL + path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload
      ? (payload as { error?: { code?: string; message?: string } }).error
      : undefined;
    throw new EmergencyApiError(response.status, error?.code ?? 'REQUEST_FAILED', error?.message ?? 'Emergency request failed.');
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new EmergencyApiError(response.status, 'INVALID_RESPONSE', 'The server returned an invalid response.');
  }
  return (payload as { data: T }).data;
};

export interface EmergencyDiscoveryHospital {
  id: string;
  name: string;
  type: string;
  services: string[];
  capabilities: string[];
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  distanceMeters: number;
  straightLineDistanceMeters: number;
  distanceType: 'DRIVING' | 'STRAIGHT_LINE';
  etaMinutes: number | null;
  estimatedTime: string | null;
  emergencyAvailability: 'AVAILABLE' | 'LIMITED';
  verified: boolean;
  lastUpdated: string;
}

export const emergencyApi = {
  discover: (latitude: number, longitude: number, category: EmergencySituationId, radiusMeters = 30000, includeRoutes = true) => {
    const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), category, radiusMeters: String(radiusMeters), limit: '10', includeRoutes: String(includeRoutes) });
    return request<{ items: EmergencyDiscoveryHospital[]; pagination: { page: number; limit: number; total: number; totalPages: number }; searchedAt: string }>('/emergencies/discovery?' + query.toString());
  },
  create: (input: CreateEmergencyRequest, idempotencyKey: string) =>
    request<EmergencyRequestView>('/emergencies', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(input) }),
  list: (params: { page?: number; limit?: number; status?: EmergencyRequestView['status']; from?: string; to?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const suffix = query.toString();
    return request<{ items: EmergencyRequestView[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/emergencies' + (suffix ? '?' + suffix : ''),
    );
  },
  get: (id: string) => request<EmergencyRequestView>('/emergencies/' + encodeURIComponent(id)),
  cancel: (id: string) =>
    request<EmergencyRequestView>('/emergencies/' + encodeURIComponent(id) + '/cancel', { method: 'POST', body: '{}' }),
};
