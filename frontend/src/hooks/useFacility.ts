import { useQuery } from '@tanstack/react-query';
import { facilityApi } from '../services/facilityApi';

export function useFacility(id?: string) {
  const query = useQuery({
    queryKey: ['facility', id],
    queryFn: () => facilityApi.getById(id as string),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const facility = query.data ?? null;
  const isNotFound = query.isError || (!query.isLoading && query.isSuccess && !facility);
  const isUnavailable = Boolean(facility && (facility.isAvailable === false || !facility.isOpen));
  const isStale = Boolean(facility && facility.isStale);

  return {
    facility,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isNotFound,
    isUnavailable,
    isStale,
    refetch: query.refetch,
  };
}