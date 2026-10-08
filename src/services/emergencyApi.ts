import type { CreateEmergencyRequest, EmergencyRequestView } from '../types/emergency';

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
  const response = await fetch(API_BASE + path, {
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

export const emergencyApi = {
  create: (input: CreateEmergencyRequest) =>
    request<EmergencyRequestView>('/emergencies', { method: 'POST', body: JSON.stringify(input) }),
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
