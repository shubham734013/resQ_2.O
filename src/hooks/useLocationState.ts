import { useState, useCallback } from 'react';
import { DEFAULT_USER_LOCATION } from '../data/mockFacilities';
import type { UserLocation } from '../types/facility';

export function useLocationState() {
  const [currentLocation, setCurrentLocation] = useState<UserLocation>(DEFAULT_USER_LOCATION);
  const [isUpdating, setIsUpdating] = useState(false);

  const refreshLocation = useCallback(() => {
    setIsUpdating(true);
    // Simulate high-accuracy GPS fix update
    setTimeout(() => {
      setCurrentLocation({
        latitude: 37.7749,
        longitude: -122.4194,
        label: 'Downtown Medical District, SF',
        accuracy: 'high',
      });
      setIsUpdating(false);
    }, 400);
  }, []);

  return {
    currentLocation,
    isUpdating,
    refreshLocation,
  };
}
