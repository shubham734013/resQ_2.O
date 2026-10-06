import type { Facility } from '../types/facility';

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5001/api/v1');

async function request<T>(path: string): Promise<T> {
  const response = await fetch(API_BASE + path, { credentials: 'include' });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload && typeof payload === 'object' && 'error' in payload ? String((payload as { error?: { message?: string } }).error?.message ?? 'Facility request failed') : 'Facility request failed');
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new Error('Invalid facility response');
  return (payload as { data: T }).data;
}

export interface FacilitySearchFilters {
  searchQuery?: string;
  category?: string;
  emergencyOnly?: boolean;
}

export const facilityApi = {
  search: (filters: FacilitySearchFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.searchQuery?.trim()) params.set('q', filters.searchQuery.trim());
    if (filters.category) params.set('category', filters.category);
    if (filters.emergencyOnly) params.set('emergencyOnly', 'true');
    return request<{ items: Facility[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/facilities/search?' + params.toString());
  },
  getById: (id: string) => request<Facility>('/facilities/' + encodeURIComponent(id)),
};