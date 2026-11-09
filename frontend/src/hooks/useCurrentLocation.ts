import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoPoint, LocationPermissionState, LocationState } from '../types/maps';

const errorMessage = (error: GeolocationPositionError): string => {
  if (error.code === error.PERMISSION_DENIED) return 'LOCATION_PERMISSION_DENIED';
  if (error.code === error.POSITION_UNAVAILABLE) return 'LOCATION_UNAVAILABLE';
  if (error.code === error.TIMEOUT) return 'LOCATION_TIMEOUT';
  return 'LOCATION_UNAVAILABLE';
};

const readPermission = async (): Promise<LocationPermissionState> => {
  if (!navigator.geolocation) return 'unsupported';
  if (!('permissions' in navigator)) return 'unknown';
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state as LocationPermissionState;
  } catch {
    return 'unknown';
  }
};

export function useCurrentLocation(): LocationState {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<LocationPermissionState>('unknown');
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setPermissionState('unsupported');
      setError('Your browser does not support location services.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setPermissionState('granted');
        setLoading(false);
      },
      (positionError) => {
        setError(errorMessage(positionError));
        setPermissionState(positionError.code === positionError.PERMISSION_DENIED ? 'denied' : 'unknown');
        setLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }, []);

  useEffect(() => {
    let active = true;
    void readPermission().then((state) => {
      if (!active) return;
      setPermissionState(state);
      if (state === 'granted') {
        stopWatching();
        watchId.current = navigator.geolocation.watchPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy,
              timestamp: position.timestamp,
            });
            setPermissionState('granted');
            setLoading(false);
          },
          (positionError) => {
            setError(errorMessage(positionError));
            setPermissionState(positionError.code === positionError.PERMISSION_DENIED ? 'denied' : 'unknown');
            setLoading(false);
          },
          { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
        );
      }
    });
    return () => { active = false; stopWatching(); };
  }, [stopWatching]);

  return { location, loading, permissionState, error, refreshLocation };
}