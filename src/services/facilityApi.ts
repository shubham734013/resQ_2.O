import type { Facility } from '../types/facility';

const API_BASE_URL = (() => { const value = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim(); if (!value) throw new Error('VITE_API_BASE_URL is required.'); return value.replace(/\/$/, ''); })();

async function request<T>(path: string): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include' });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload && typeof payload === 'object' && 'error' in payload ? String((payload as { error?: { message?: string } }).error?.message ?? 'Facility request failed') : 'Facility request failed');
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new Error('Invalid facility response');
  return (payload as { data: T }).data;
}

export interface FacilitySearchFilters {
  searchQuery?: string;
  category?: string;
  emergencyOnly?: boolean;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
}

export const facilityApi = {
  search: (filters: FacilitySearchFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.searchQuery?.trim()) params.set('q', filters.searchQuery.trim());
    if (filters.category) params.set('category', filters.category);
    if (filters.emergencyOnly) params.set('emergencyOnly', 'true');
    if (filters.latitude !== undefined) params.set('latitude', String(filters.latitude));
    if (filters.longitude !== undefined) params.set('longitude', String(filters.longitude));
    if (filters.radiusMeters !== undefined) params.set('radiusMeters', String(filters.radiusMeters));
    return request<{ items: Facility[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/facilities/search?' + params.toString());
  },
  getById: (id: string) => request<Facility>('/facilities/' + encodeURIComponent(id)),
};