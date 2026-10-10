import { useQuery } from '@tanstack/react-query';
import { mapsApi } from '../services/mapsApi';
import type { Facility, UserLocation } from '../types/facility';
import type { RouteOptionItem } from '../types/route';

const isValidCoordinate = (latitude: unknown, longitude: unknown): latitude is number =>
  typeof latitude === 'number'
  && Number.isFinite(latitude)
  && latitude >= -90
  && latitude <= 90
  && typeof longitude === 'number'
  && Number.isFinite(longitude)
  && longitude >= -180
  && longitude <= 180;

const retryTransientFailure = (failureCount: number, error: unknown): boolean => {
  // A 4xx response is a deterministic client/request error. Retrying the same payload
  // only creates duplicate failed requests; retry network errors and server failures once.
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
  const origin = location && isValidCoordinate(location.latitude, location.longitude)
    ? { latitude: location.latitude, longitude: location.longitude }
    : null;
  const destination = facility && isValidCoordinate(facility.latitude, facility.longitude)
    ? { latitude: facility.latitude, longitude: facility.longitude }
    : null;
  const destinationAddress = facility
    ? [facility.name, facility.address].filter((part) => typeof part === 'string' && part.trim()).join(', ')
    : '';

  // Some directory records have an address but no persisted coordinates. Geocode those
  // records instead of silently disabling route calculation and showing a false route error.
  const geocodedDestinationQuery = useQuery({
    queryKey: ['facility-route-geocode', facility?.id, destinationAddress],
    queryFn: () => mapsApi.geocode(destinationAddress),
    enabled: Boolean(facility && !destination && destinationAddress.length >= 2),
    staleTime: 24 * 60 * 60 * 1000,
    retry: retryTransientFailure,
  });

  const resolvedDestination = destination ?? (
    geocodedDestinationQuery.data
      && isValidCoordinate(geocodedDestinationQuery.data.latitude, geocodedDestinationQuery.data.longitude)
      ? {
          latitude: geocodedDestinationQuery.data.latitude,
          longitude: geocodedDestinationQuery.data.longitude,
        }
      : null
  );

  const query = useQuery({
    queryKey: ['google-route', origin?.latitude, origin?.longitude, resolvedDestination?.latitude, resolvedDestination?.longitude],
    queryFn: () => mapsApi.route({
      origin: origin as { latitude: number; longitude: number },
      destination: resolvedDestination as { latitude: number; longitude: number },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    }),
    enabled: Boolean(origin && resolvedDestination),
    staleTime: 30_000,
    retry: retryTransientFailure,
  });

  const refetchRoute = async () => {
    if (!destination && !geocodedDestinationQuery.data) {
      // Once geocoding resolves, the query above becomes enabled and computes the route.
      return geocodedDestinationQuery.refetch();
    }
    return query.refetch();
  };

  const routes = query.data?.routes.map(toRouteItem) ?? [];
  const isGeocodingDestination = geocodedDestinationQuery.isLoading;
  const geocodingFailed = geocodedDestinationQuery.isError;
  return {
    ...query,
    routes,
    isLoading: query.isLoading || isGeocodingDestination,
    isError: query.isError || geocodingFailed,
    error: query.error ?? geocodedDestinationQuery.error,
    refetch: refetchRoute,
  };
}
