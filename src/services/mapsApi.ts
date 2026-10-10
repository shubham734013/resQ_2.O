import type { AmbulanceMapItem, FacilityMapItem, PlaceSearchResult, RouteRequest, RouteResult } from '../types/maps';

const API_BASE_URL = (() => { const value = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim(); if (!value) throw new Error('VITE_API_BASE_URL is required.'); return value.replace(/\/$/, ''); })();

type ApiIssue = { path?: Array<string | number>; message?: string };
type ApiErrorPayload = { code?: string; message?: string; details?: ApiIssue[] };

class MapsApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: ApiIssue[];

  constructor(status: number, code: string, message: string, details: ApiIssue[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'MapsApiError';
  }
}

const formatApiError = (error: ApiErrorPayload | undefined, fallback: string): string => {
  const message = error?.message?.trim() || fallback;
  const issues = error?.details
    ?.map((issue) => {
      const path = issue.path?.length ? issue.path.join('.') : 'request';
      return path + ': ' + (issue.message?.trim() || 'invalid value');
    })
    .filter(Boolean);
  return issues?.length ? message + ' (' + issues.join('; ') + ')' : message;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload
      ? (payload as { error?: ApiErrorPayload }).error
      : undefined;
    throw new MapsApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      formatApiError(error, 'The map request could not be completed.'),
      Array.isArray(error?.details) ? error.details : [],
    );
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new MapsApiError(response.status, 'INVALID_RESPONSE', 'The server returned an invalid map response.');
  }
  return (payload as { data: T }).data;
}

export const mapsApi = {
  nearbyFacilities: (latitude: number, longitude: number, options: { radius?: number; page?: number; limit?: number; emergencyAvailability?: string; hospitalType?: string; service?: string; capability?: string } = {}) => {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), radius: String(options.radius ?? 10000), page: String(options.page ?? 1), limit: String(options.limit ?? 50) });
    if (options.emergencyAvailability) params.set('emergencyAvailability', options.emergencyAvailability);
    if (options.hospitalType) params.set('hospitalType', options.hospitalType);
    if (options.service) params.set('service', options.service);
    if (options.capability) params.set('capability', options.capability);
    return request<{ items: FacilityMapItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/facilities/nearby?' + params.toString());
  },
  nearbyAmbulances: (latitude: number, longitude: number, radius = 10000) =>
    request<{ items: AmbulanceMapItem[]; updatedAt: string }>(
      '/ambulances/nearby?latitude=' + latitude + '&longitude=' + longitude + '&radius=' + radius,
    ),
  route: (input: RouteRequest) => {
    // Send only the fields accepted by the strict backend schema. This also prevents
    // accidental UI metadata from a coordinate/facility object leaking into the request.
    const body: RouteRequest = {
      origin: { latitude: Number(input.origin.latitude), longitude: Number(input.origin.longitude) },
      destination: { latitude: Number(input.destination.latitude), longitude: Number(input.destination.longitude) },
      travelMode: input.travelMode ?? 'DRIVE',
      routingPreference: input.routingPreference ?? 'TRAFFIC_AWARE',
    };
    return request<RouteResult>('/maps/routes', { method: 'POST', body: JSON.stringify(body) });
  },

  geocode: (address: string) =>
    request<{ placeId: string; formattedAddress: string; latitude: number; longitude: number }>(
      '/geocoding',
      { method: 'POST', body: JSON.stringify({ address }) },
    ),
  placeSearch: (query: string): Promise<PlaceSearchResult[]> =>
    request<PlaceSearchResult[]>('/places/search', { method: 'POST', body: JSON.stringify({ query }) }),
};
