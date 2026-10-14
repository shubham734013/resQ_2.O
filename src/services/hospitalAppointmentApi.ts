const API_BASE = (() => {
  const value = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!value) throw new Error('VITE_API_BASE_URL is required.');
  return value.replace(/\/$/, '');
})();

export class AppointmentApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppointmentApiError';
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
    throw new AppointmentApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'The request could not be completed.'
    );
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new AppointmentApiError(response.status, 'INVALID_RESPONSE', 'The server returned an invalid response.');
  }
  return (payload as { data: T }).data;
}

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ALTERNATIVE_PROPOSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export interface AppointmentSlotItem {
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bookedCount: number;
  availableCapacity: number;
  isAvailable: boolean;
  slotDurationMinutes: number;
}

export interface DaySchedule {
  dayOfWeek: number;
  isEnabled: boolean;
  startTime: string;
  endTime: string;
  breakStartTime?: string;
  breakEndTime?: string;
}

export interface HospitalAppointmentAvailability {
  _id?: string;
  hospitalId?: string;
  department: string;
  slotDurationMinutes: number;
  maxCapacityPerSlot: number;
  weeklySchedule: DaySchedule[];
  blackoutDates: string[];
  isActive: boolean;
}

export interface AlternativeSlotProposal {
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  proposedAt: string;
  proposedBy: string;
}

export interface HospitalAppointment {
  _id: string;
  appointmentCode: string;
  userId: string | { _id: string; name: string; email: string; phone?: string };
  hospitalId: string | { _id: string; name: string; phone: string; address?: string; city?: string };
  slotId: string;
  serviceDepartment: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  status: AppointmentStatus;
  visitReason: string;
  notes?: string;
  alternativeSlot?: AlternativeSlotProposal;
  rejectionReason?: string;
  cancellationReason?: string;
  statusHistory: Array<{
    status: AppointmentStatus;
    timestamp: string;
    updatedBy: string;
    role: string;
    reason?: string;
    notes?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface BookAppointmentInput {
  hospitalId: string;
  department: string;
  date: string;
  startTime: string;
  visitReason: string;
  notes?: string;
}

export interface ProposeAlternativeSlotInput {
  date: string;
  startTime: string;
  notes?: string;
}

export const hospitalAppointmentApi = {
  // Availability
  queryAvailability: (hospitalId: string, department: string, date: string) => {
    const params = new URLSearchParams({ hospitalId, department, date });
    return request<{
      isConfigured: boolean;
      isBlackout?: boolean;
      isDayOff?: boolean;
      date: string;
      department: string;
      slotDurationMinutes?: number;
      slots: AppointmentSlotItem[];
    }>(`/appointments/availability?${params.toString()}`);
  },

  // Citizen
  bookAppointment: (input: BookAppointmentInput) =>
    request<HospitalAppointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listMyAppointments: (query: { page?: number; limit?: number; status?: AppointmentStatus; date?: string; department?: string } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.status) params.set('status', query.status);
    if (query.date) params.set('date', query.date);
    if (query.department) params.set('department', query.department);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ items: HospitalAppointment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/appointments/mine${qs}`
    );
  },

  getMyAppointmentById: (id: string) =>
    request<HospitalAppointment>(`/appointments/${encodeURIComponent(id)}`),

  cancelMyAppointment: (id: string, cancellationReason?: string) =>
    request<HospitalAppointment>(`/appointments/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancellationReason }),
    }),

  // Hospital management
  listHospitalAppointments: (query: { page?: number; limit?: number; status?: AppointmentStatus; date?: string; department?: string } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.status) params.set('status', query.status);
    if (query.date) params.set('date', query.date);
    if (query.department) params.set('department', query.department);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ items: HospitalAppointment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/hospital-appointments${qs}`
    );
  },

  getHospitalAppointmentById: (id: string) =>
    request<HospitalAppointment>(`/hospital-appointments/${encodeURIComponent(id)}`),

  confirmAppointment: (id: string, notes?: string) =>
    request<HospitalAppointment>(`/hospital-appointments/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  rejectAppointment: (id: string, rejectionReason: string) =>
    request<HospitalAppointment>(`/hospital-appointments/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    }),

  proposeAlternativeSlot: (id: string, input: ProposeAlternativeSlotInput) =>
    request<HospitalAppointment>(`/hospital-appointments/${encodeURIComponent(id)}/propose-alternative`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  completeAppointment: (id: string) =>
    request<HospitalAppointment>(`/hospital-appointments/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body: '{}',
    }),

  getHospitalAvailabilitySettings: () =>
    request<HospitalAppointmentAvailability[]>('/hospital-appointments/settings/availability'),

  updateHospitalAvailabilitySettings: (input: HospitalAppointmentAvailability) =>
    request<HospitalAppointmentAvailability>('/hospital-appointments/settings/availability', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
};
