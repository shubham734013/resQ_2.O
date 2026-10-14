const API_BASE = (() => {
  const value = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!value) throw new Error('VITE_API_BASE_URL is required.');
  return value.replace(/\/$/, '');
})();

export interface CareNotificationItem {
  _id: string;
  recipientType: 'USER' | 'HOSPITAL';
  recipientId: string;
  careRequestId?: string;
  appointmentId?: string;
  type: string;
  title: string;
  message: string;
  status: 'UNREAD' | 'READ';
  readAt?: string;
  createdAt: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }
  return (payload as { data: T }).data;
}

export const hospitalCareNotificationApi = {
  // User notifications
  listUserNotifications: (query: { page?: number; limit?: number; unreadOnly?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.unreadOnly) params.set('unreadOnly', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ items: CareNotificationItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/users/notifications${qs}`
    );
  },

  markUserNotificationRead: (id: string) =>
    request<CareNotificationItem>(`/users/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),

  // Hospital notifications
  listHospitalNotifications: (query: { page?: number; limit?: number; unreadOnly?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.unreadOnly) params.set('unreadOnly', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ items: CareNotificationItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/hospital/notifications${qs}`
    );
  },

  markHospitalNotificationRead: (id: string) =>
    request<CareNotificationItem>(`/hospital/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
};
