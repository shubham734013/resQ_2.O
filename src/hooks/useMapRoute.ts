import { useQuery } from '@tanstack/react-query';
import { mapsApi } from '../services/mapsApi';
import type { Facility, UserLocation } from '../types/facility';
import type { RouteOptionItem } from '../types/route';

const retryTransientFailure = (failureCount: number, error: unknown): boolean => {
  // A 4xx response is deterministic; retrying the same request only repeats the failure.
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) return false;
  }
  return failureCount < 1;
};

const toRouteItem = (route: Awaited<ReturnType<typeof mapsApi.route>>['routes'][number]): RouteOptionItem => ({
  id: route.id,
  name: route.recommended ? 'Fastest route' : 'Alternative route',
  distance: route.distanceText,
  duration: route.durationText,
  durationSeconds: route.durationSeconds,
  trafficCondition: route.trafficCondition === 'HEAVY'
    ? 'heavy'
    : route.trafficCondition === 'MODERATE'
      ? 'moderate'
      : route.trafficCondition === 'UNKNOWN'
        ? 'unknown'
        : 'light',
  summary: route.summary,
  viaRoute: 'Google route',
  isRecommended: route.recommended,
  polylinePoints: route.polyline.map((point) => ({ x: 0, y: 0, latitude: point.latitude, longitude: point.longitude })),
  googlePath: route.polyline,
  instructions: route.instructions,
});

export function useMapRoute(facility: Facility | null, location: UserLocation | null) {
  const origin = location
    && Number.isFinite(location.latitude) && location.latitude >= -90 && location.latitude <= 90
    && Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 180
    ? { latitude: location.latitude, longitude: location.longitude }
    : null;
  const destination = facility
    && Number.isFinite(facility.latitude) && facility.latitude >= -90 && facility.latitude <= 90
    && Number.isFinite(facility.longitude) && facility.longitude >= -180 && facility.longitude <= 180
    ? { latitude: facility.latitude, longitude: facility.longitude }
    : null;

  const query = useQuery({
    queryKey: ['google-route', origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude],
    queryFn: () => mapsApi.route({
      origin: origin as { latitude: number; longitude: number },
      destination: destination as { latitude: number; longitude: number },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    }),
    enabled: Boolean(origin && destination),
    staleTime: 30_000,
    retry: retryTransientFailure,
  });

  const routes = query.data?.routes.map(toRouteItem) ?? [];
  return { ...query, routes };
}
