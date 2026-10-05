import { useQuery } from '@tanstack/react-query';
import { MOCK_FACILITIES } from '../data/mockFacilities';
import type { Facility } from '../types/facility';

async function fetchFacilityById(id?: string): Promise<Facility | null> {
  if (!id) return null;
  // Simulate rapid in-memory async fetch
  await new Promise((resolve) => setTimeout(resolve, 60));
  const found = MOCK_FACILITIES.find((f) => f.id === id);
  return found ?? null;
}

export function useFacility(id?: string) {
  const query = useQuery({
    queryKey: ['facility', id],
    queryFn: () => fetchFacilityById(id),
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(id),
  });

  const facility = query.data ?? null;
  const isNotFound = !query.isLoading && query.isSuccess && !facility;
  const isUnavailable = Boolean(facility && (facility.isAvailable === false || !facility.isOpen));
  const isStale = Boolean(facility && facility.isStale);

  return {
    facility,
    isLoading: query.isLoading,
    isError: query.isError,
    isNotFound,
    isUnavailable,
    isStale,
  };
}
