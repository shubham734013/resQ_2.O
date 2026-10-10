import type { RouteOptionItem } from '../types/route';

const API_BASE = (() => {
  const value = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!value) throw new Error('VITE_API_BASE_URL is required.');
  return value.replace(/\/$/, '');
})();

async function request<T>(path: string): Promise<T> {
  const response = await fetch(API_BASE + path, { credentials: 'include', headers: { Accept: 'application/json' } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? (payload as { error?: { message?: string; code?: string } }).error : undefined;
    throw new Error(error?.message ?? 'Tracking information is temporarily unavailable.');
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new Error('Invalid tracking snapshot response.');
  return (payload as { data: T }).data;
}

export interface TrackingSnapshot {
  emergency: { id: string; requestCode: string; status: string; situationType: string; reportedAt: string; updatedAt: string };
  pickup: { latitude: number | null; longitude: number | null; label: string };
  hospital: { id: string; name: string; address: string; city: string; phone: string | null; latitude: number | null; longitude: number | null };
  dispatch: null | { status: string; attemptCount: number; exhaustedAt: string | null; escalatedAt: string | null; escalationReason: string | null; updatedAt: string | null };
  trip: null | { id: string; status: string; acceptedAt: string | null; arrivedAtPickupAt: string | null; patientPickedUpAt: string | null; arrivedAtHospitalAt: string | null; completedAt: string | null; statusHistory: Array<{ status: string; changedAt: string }>; trackingActive: boolean };
  ambulance: null | { id: string; vehicleNumber: string; registrationNumber: string; ambulanceType: string; driverName: string | null };
  location: null | { latitude: number | null; longitude: number | null; accuracyMeters: number | null; updatedAt: string | null; sourceTimestamp: string | null; ageMs: number | null; freshness: 'FRESH' | 'STALE'; coordinatesAreLive: boolean };
  trackingActive: boolean;
  routeTarget: 'PICKUP' | 'HOSPITAL';
  serverTime: string;
}
interface GoogleRoute {
  id: string; distanceMeters: number; durationSeconds: number; distanceText: string; durationText: string;
  polyline: Array<{ latitude: number; longitude: number }>; summary: string;
  trafficCondition: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'UNKNOWN'; recommended: boolean;
  instructions: RouteOptionItem['instructions'];
}
export interface TrackingRouteResponse {
  routes: GoogleRoute[];
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  fetchedAt: string;
}
export const trackingApi = {
  getEmergency: (id: string) => request<TrackingSnapshot>(`/tracking/emergencies/${encodeURIComponent(id)}`),
  getTrip: (id: string) => request<TrackingSnapshot>(`/tracking/trips/${encodeURIComponent(id)}`),
  getRoute: (tripId: string) => request<TrackingRouteResponse>(`/tracking/trips/${encodeURIComponent(tripId)}/route`),
};
export const trackingRouteOption = (route: GoogleRoute): RouteOptionItem => ({
  id: route.id,
  name: route.recommended ? 'Current driving route' : 'Alternative route',
  distance: route.distanceText,
  duration: route.durationText,
  durationSeconds: route.durationSeconds,
  trafficCondition: route.trafficCondition.toLowerCase() as RouteOptionItem['trafficCondition'],
  summary: route.summary,
  viaRoute: 'Google Routes',
  isRecommended: route.recommended,
  polylinePoints: route.polyline.map((point) => ({ x: 0, y: 0, latitude: point.latitude, longitude: point.longitude })),
  googlePath: route.polyline,
  instructions: route.instructions,
});
