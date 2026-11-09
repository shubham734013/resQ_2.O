import { useQuery } from '@tanstack/react-query';
import { mapsApi } from '../services/mapsApi';

export function useNearbyFacilities(latitude: number | null, longitude: number | null, radius = 10000) {
  const query = useQuery({
    queryKey: ['nearby-facilities', latitude, longitude, radius],
    queryFn: () => mapsApi.nearbyFacilities(latitude as number, longitude as number, { radius }),
    enabled: latitude !== null && longitude !== null,
    staleTime: 60_000,
  });

  return query;
}