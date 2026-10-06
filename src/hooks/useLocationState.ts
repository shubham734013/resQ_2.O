import { useCallback, useMemo } from 'react';
import { useCurrentLocation } from './useCurrentLocation';
import type { UserLocation } from '../types/facility';

export function useLocationState() {
  const { location, loading, permissionState, error, refreshLocation } = useCurrentLocation(false);

  const currentLocation = useMemo<UserLocation>(() => {
    if (!location) {
      return {
        latitude: 0,
        longitude: 0,
        label: 'Location unavailable',
        accuracy: 'approximate',
      };
    }
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      label: 'Current location',
      accuracy: (location.accuracyMeters ?? 100) <= 50 ? 'high' : 'approximate',
      accuracyMeters: location.accuracyMeters,
      timestamp: location.timestamp,
    };
  }, [location]);

  const requestLocation = useCallback(() => refreshLocation(), [refreshLocation]);

  return {
    currentLocation,
    location,
    isUpdating: loading,
    permissionState,
    locationError: error,
    refreshLocation: requestLocation,
  };
}