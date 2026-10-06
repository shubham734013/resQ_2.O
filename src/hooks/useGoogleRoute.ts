import { useQuery } from '@tanstack/react-query';
import { mapsApi } from '../services/mapsApi';
import type { Facility, UserLocation } from '../types/facility';
import type { RouteOptionItem } from '../types/route';

const toRouteItem = (route: Awaited<ReturnType<typeof mapsApi.route>>['routes'][number]): RouteOptionItem => ({
  id: route.id,
  name: route.recommended ? 'Fastest route' : 'Alternative route',
  distance: route.distanceText,
  duration: route.durationText,
  durationSeconds: route.durationSeconds,
  trafficCondition: route.trafficCondition === 'HEAVY' ? 'heavy' : route.trafficCondition === 'MODERATE' ? 'moderate' : 'light',
  summary: route.summary,
  viaRoute: route.trafficCondition === 'UNKNOWN' ? 'Google route' : route.trafficCondition === 'HEAVY' ? 'Traffic-aware' : 'Traffic-aware route',
  isRecommended: route.recommended,
  polylinePoints: route.polyline.map((point) => ({ x: 0, y: 0, latitude: point.latitude, longitude: point.longitude })),
  googlePath: route.polyline,
  instructions: route.instructions,
});

export function useGoogleRoute(facility: Facility | null, location: UserLocation | null) {
  const origin = location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    ? { latitude: location.latitude, longitude: location.longitude }
    : null;
  const destination = facility ? { latitude: facility.latitude, longitude: facility.longitude } : null;

  const query = useQuery({
    queryKey: ['google-route', origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude],
    queryFn: () => mapsApi.route({ origin: origin as { latitude: number; longitude: number }, destination: destination as { latitude: number; longitude: number }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE' }),
    enabled: Boolean(origin && destination),
    staleTime: 30_000,
    retry: 1,
  });

  const routes = query.data?.routes.map(toRouteItem) ?? [];
  return { ...query, routes };
}