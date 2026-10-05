import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MOCK_FACILITIES } from '../data/mockFacilities';
import type { Facility, FacilityCategory } from '../types/facility';

export interface UseFacilitiesFilter {
  searchQuery?: string;
  category?: FacilityCategory;
  emergencyOnly?: boolean;
}

// Simulated network fetch to demonstrate real async behavior with TanStack Query
async function fetchFacilities(): Promise<Facility[]> {
  // Simulate rapid in-memory fetch
  await new Promise((resolve) => setTimeout(resolve, 50));
  return MOCK_FACILITIES;
}

export function useFacilities(filters: UseFacilitiesFilter = {}) {
  const { searchQuery = '', category = 'all', emergencyOnly = false } = filters;
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    MOCK_FACILITIES[0]?.id ?? null
  );

  // Debounced search query to provide smooth typing and realistic searching feedback
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const isSearching = searchQuery !== debouncedQuery;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const query = useQuery({
    queryKey: ['facilities'],
    queryFn: fetchFacilities,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const filteredFacilities = useMemo(() => {
    const list = query.data ?? [];
    return list.filter((fac) => {
      // Category filter
      if (category !== 'all' && fac.category !== category) {
        return false;
      }
      // Emergency only filter
      if (emergencyOnly && !fac.emergencyAvailable) {
        return false;
      }
      // Search query filter with smart token matching
      if (debouncedQuery.trim()) {
        const queryLower = debouncedQuery.toLowerCase().trim();
        const tokens = queryLower.split(/\s+/).filter(Boolean);

        const searchableText = [
          fac.name,
          fac.type,
          fac.category,
          fac.address,
          fac.openStatus,
          ...fac.capabilities,
          fac.emergencyAvailable ? 'emergency 24/7' : '',
          fac.category === 'urgent_care' ? 'urgent care clinic walk-in' : '',
          fac.category === 'trauma' ? 'trauma center' : '',
          fac.category === 'pediatric' ? 'pediatric children' : '',
        ]
          .join(' ')
          .toLowerCase();

        return tokens.every((token) => searchableText.includes(token));
      }
      return true;
    });
  }, [query.data, category, emergencyOnly, debouncedQuery]);

  const selectedFacility = useMemo(() => {
    if (!selectedFacilityId) return null;
    return filteredFacilities.find((f) => f.id === selectedFacilityId) ?? null;
  }, [filteredFacilities, selectedFacilityId]);

  const isInitialState = !debouncedQuery.trim() && category === 'all' && !emergencyOnly;
  const isNoResults = !isSearching && !query.isLoading && filteredFacilities.length === 0;
  const isResultsState = !isSearching && filteredFacilities.length > 0;

  return {
    ...query,
    facilities: filteredFacilities,
    allFacilities: query.data ?? [],
    selectedFacility,
    selectedFacilityId,
    setSelectedFacilityId,
    isSearching,
    isInitialState,
    isNoResults,
    isResultsState,
    activeQuery: debouncedQuery,
  };
}
