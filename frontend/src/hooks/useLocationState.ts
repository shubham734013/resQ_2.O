import { useCallback, useMemo } from 'react';
import { useCurrentLocation } from './useCurrentLocation';
import type { UserLocation } from '../types/facility';

export const DEFAULT_JAIPUR_LOCATION: UserLocation = {
  latitude: 26.9124,
  longitude: 75.7873,
  label: 'Jaipur, Rajasthan',
  accuracy: 'approximate',
};

export function useLocationState() {
  const { location, loading, permissionState, error, refreshLocation } = useCurrentLocation();

  const isDefaultLocation = !location;

  const currentLocation = useMemo<UserLocation>(() => {
    if (!location) {
      return DEFAULT_JAIPUR_LOCATION;
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
    isDefaultLocation,
    isUpdating: loading,
    permissionState,
    locationError: error,
    refreshLocation: requestLocation,
  };
}