import { useQuery } from '@tanstack/react-query';
import { mapsApi } from '../services/mapsApi';
import type { RouteOptionItem } from '../types/route';

interface Coordinate { latitude: number; longitude: number }

const mapRoute = (route: Awaited<ReturnType<typeof mapsApi.route>>['routes'][number]): RouteOptionItem => ({
  id: route.id,
  name: route.recommended ? 'Fastest route' : 'Alternative route',
  distance: route.distanceText,
  duration: route.durationText,
  durationSeconds: route.durationSeconds,
  trafficCondition: route.trafficCondition === 'HEAVY'
    ? 'heavy'
    : route.trafficCondition === 'MODERATE'
      ? 'moderate'
      : 'unknown',
  summary: route.summary,
  viaRoute: 'Google route',
  isRecommended: route.recommended,
  polylinePoints: route.polyline.map((p) => ({ x: 0, y: 0, latitude: p.latitude, longitude: p.longitude })),
  googlePath: route.polyline,
  instructions: route.instructions,
});

export function useAmbulanceRoute(origin: Coordinate | null, destination: Coordinate | null) {
  const query = useQuery({
    queryKey: ['ambulance-google-route', origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude],
    queryFn: () => mapsApi.route({
      origin: origin as Coordinate,
      destination: destination as Coordinate,
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    }),
    enabled: Boolean(origin && destination),
    staleTime: 30_000,
    retry: 1,
  });

  return { ...query, routes: query.data?.routes.map(mapRoute) ?? [] };
}
