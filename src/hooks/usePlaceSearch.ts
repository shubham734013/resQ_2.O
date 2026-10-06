import { useQuery } from '@tanstack/react-query';
import { mapsApi } from '../services/mapsApi';

export function usePlaceSearch(query: string) {
  return useQuery({
    queryKey: ['google-place-search', query],
    queryFn: () => mapsApi.placeSearch(query),
    enabled: query.trim().length >= 3 && Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim()),
    staleTime: 60_000,
  });
}