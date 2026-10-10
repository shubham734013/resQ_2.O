import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facilityApi } from '../services/facilityApi';
import type { FacilityCategory } from '../types/facility';

export interface UseFacilitiesFilter {
  searchQuery?: string;
  category?: FacilityCategory;
  emergencyOnly?: boolean;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  page?: number;
  limit?: number;
}

export function useFacilities(filters: UseFacilitiesFilter = {}) {
  const { searchQuery = '', category = 'all', emergencyOnly = false, latitude, longitude, radiusMeters = 50000, page = 1, limit = 20 } = filters;
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const query = useQuery({
    queryKey: ['facilities', debouncedQuery, category, emergencyOnly, latitude, longitude, radiusMeters, page, limit],
    queryFn: () => facilityApi.search({ searchQuery: debouncedQuery, category, emergencyOnly, latitude, longitude, radiusMeters, page, limit }),
    staleTime: 60_000,
  });

  const facilitiesData = query.data?.items;
  const facilities = useMemo(() => facilitiesData ?? [], [facilitiesData]);
  const selectedFacility = useMemo(
    () => (selectedFacilityId ? facilities.find((facility) => facility.id === selectedFacilityId) ?? null : null),
    [facilities, selectedFacilityId],
  );

  return {
    ...query,
    facilities,
    allFacilities: facilities,
    selectedFacility,
    selectedFacilityId,
    setSelectedFacilityId,
    isSearching: searchQuery !== debouncedQuery,
    isInitialState: !debouncedQuery.trim() && category === 'all' && !emergencyOnly,
    isNoResults: !query.isLoading && facilities.length === 0,
    isResultsState: !query.isLoading && facilities.length > 0,
    activeQuery: debouncedQuery,
  };
}