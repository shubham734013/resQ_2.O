import type { AmbulanceMapItem, FacilityMapItem, PlaceSearchResult, RouteRequest, RouteResult } from '../types/maps';

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5001/api/v1');

class MapsApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'MapsApiError';
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
    const error = payload && typeof payload === 'object' && 'error' in payload
      ? (payload as { error?: { code?: string; message?: string } }).error
      : undefined;
    throw new MapsApiError(response.status, error?.code ?? 'REQUEST_FAILED', error?.message ?? 'The map request could not be completed.');
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
  route: (input: RouteRequest) =>
    request<RouteResult>('/maps/routes', { method: 'POST', body: JSON.stringify(input) }),

  geocode: (address: string) =>
    request<{ placeId: string; formattedAddress: string; latitude: number; longitude: number }>(
      '/geocoding',
      { method: 'POST', body: JSON.stringify({ address }) },
    ),
  placeSearch: async (query: string): Promise<PlaceSearchResult[]> => {
    const { loadGoogleMaps } = await import('./googleMapsLoader');
    const googleMaps = await loadGoogleMaps();
    const places = await googleMaps.maps.importLibrary('places');
    const suggestionApi = places.AutocompleteSuggestion as unknown as {
      fetchAutocompleteSuggestions: (request: { input: string; includedRegionCodes?: string[] }) => Promise<{
        suggestions: Array<{
          placePrediction?: {
            placeId: string;
            text?: { toString(): string };
            toPlace(): {
              fetchFields(options: { fields: string[] }): Promise<void>;
              displayName?: string;
              formattedAddress?: string;
              location?: { lat(): number; lng(): number };
            };
          };
        }>;
      }>;
    };
    const response = await suggestionApi.fetchAutocompleteSuggestions({ input: query });
    return Promise.all(response.suggestions.filter((s) => s.placePrediction).slice(0, 8).map(async (s) => {
      const prediction = s.placePrediction;
      if (!prediction) return { id: '', displayName: '' };
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
      return {
        id: prediction.placeId,
        displayName: place.displayName ?? prediction.text?.toString() ?? 'Place',
        formattedAddress: place.formattedAddress,
        location: place.location ? { latitude: place.location.lat(), longitude: place.location.lng() } : undefined,
      };
    }));
  },
};