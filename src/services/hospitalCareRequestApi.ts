const API_BASE = (() => {
  const value = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!value) throw new Error('VITE_API_BASE_URL is required.');
  return value.replace(/\/$/, '');
})();

export class CareRequestApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'CareRequestApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: { code?: string; message?: string } }).error
        : undefined;
    throw new CareRequestApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'The request could not be completed.'
    );
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new CareRequestApiError(response.status, 'INVALID_RESPONSE', 'The server returned an invalid response.');
  }
  return (payload as { data: T }).data;
}

export type CareRequestType =
  | 'GENERAL_CONSULTATION'
  | 'SPECIALIST_CONSULTATION'
  | 'DIAGNOSTIC'
  | 'FOLLOW_UP'
  | 'ROUTINE_CHECKUP'
  | 'OTHER';

export type CareRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type PreferredTiming = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'FLEXIBLE';
export type ContactPreference = 'PHONE' | 'EMAIL' | 'SMS' | 'IN_APP';

export interface StatusHistoryEntry {
  status: CareRequestStatus;
  timestamp: string;
  updatedBy: string;
  role: 'USER' | 'HOSPITAL' | 'ADMIN';
  reason?: string;
  notes?: string;
}

export interface HospitalCareRequest {
  _id: string;
  referenceId: string;
  userId: string | { _id: string; name: string; email: string; phone?: string };
  hospitalId: string | { _id: string; name: string; phone: string; address?: string; city?: string };
  serviceDepartment: string;
  requestType: CareRequestType;
  visitReason: string;
  preferredTiming: PreferredTiming;
  contactPreference: ContactPreference;
  status: CareRequestStatus;
  hospitalResponse?: {
    notes?: string;
    respondedAt?: string;
    respondedBy?: string;
  };
  rejectionReason?: string;
  cancellationReason?: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCareRequestInput {
  hospitalId: string;
  serviceDepartment: string;
  requestType: CareRequestType;
  visitReason: string;
  preferredTiming?: PreferredTiming;
  contactPreference?: ContactPreference;
}

export interface RespondCareRequestInput {
  action: 'ACCEPT' | 'REJECT';
  notes?: string;
  rejectionReason?: string;
}

export const hospitalCareRequestApi = {
  // Citizen endpoints
  createRequest: (input: CreateCareRequestInput) =>
    request<HospitalCareRequest>('/hospital-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listMyRequests: (query: { page?: number; limit?: number; status?: CareRequestStatus; serviceDepartment?: string } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.status) params.set('status', query.status);
    if (query.serviceDepartment) params.set('serviceDepartment', query.serviceDepartment);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ items: HospitalCareRequest[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/hospital-requests/mine${qs}`
    );
  },

  getMyRequestById: (id: string) =>
    request<HospitalCareRequest>(`/hospital-requests/${encodeURIComponent(id)}`),

  cancelMyRequest: (id: string, cancellationReason?: string) =>
    request<HospitalCareRequest>(`/hospital-requests/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancellationReason }),
    }),

  // Hospital endpoints
  listIncomingRequests: (query: { page?: number; limit?: number; status?: CareRequestStatus; serviceDepartment?: string } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.status) params.set('status', query.status);
    if (query.serviceDepartment) params.set('serviceDepartment', query.serviceDepartment);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ items: HospitalCareRequest[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/hospital-requests/incoming${qs}`
    );
  },

  getHospitalRequestById: (id: string) =>
    request<HospitalCareRequest>(`/hospital-requests/${encodeURIComponent(id)}`),

  respondToRequest: (id: string, input: RespondCareRequestInput) =>
    request<HospitalCareRequest>(`/hospital-requests/${encodeURIComponent(id)}/respond`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
