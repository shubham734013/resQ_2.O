import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mapsApi } from '../services/mapsApi';
import type { Facility, UserLocation } from '../types/facility';
import type { RouteOptionItem } from '../types/route';

const retryTransientFailure = (failureCount: number, error: unknown): boolean => {
  // A 4xx or 503 quota response is deterministic; retrying immediately will only repeat the failure.
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number' && ((status >= 400 && status < 500) || status === 503)) return false;
  }
  return failureCount < 1;
};

const toRouteItem = (route: Awaited<ReturnType<typeof mapsApi.route>>['routes'][number]): RouteOptionItem => ({
  id: route.id,
  name: route.recommended ? 'Fastest route' : 'Alternative route',
  distance: route.distanceText,
  duration: route.durationText,
  durationSeconds: route.durationSeconds,
  trafficCondition: route.trafficCondition === 'HEAVY'
    ? 'heavy'
    : route.trafficCondition === 'MODERATE'
      ? 'moderate'
      : route.trafficCondition === 'UNKNOWN'
        ? 'unknown'
        : 'light',
  summary: route.summary,
  viaRoute: 'Google route',
  isRecommended: route.recommended,
  polylinePoints: route.polyline.map((point) => ({ x: 0, y: 0, latitude: point.latitude, longitude: point.longitude })),
  googlePath: route.polyline,
  instructions: route.instructions,
});

const calculateDirectRoute = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number; name?: string },
): RouteOptionItem => {
  const R = 6371e3; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(origin.latitude);
  const phi2 = toRad(destination.latitude);
  const deltaPhi = toRad(destination.latitude - origin.latitude);
  const deltaLambda = toRad(destination.longitude - origin.longitude);
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const crowDistanceMeters = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const roadDistanceMeters = Math.max(100, Math.round(crowDistanceMeters * 1.35));
  const durationSeconds = Math.max(60, Math.round(roadDistanceMeters / 8.33));

  const formatDist = (meters: number) =>
    meters >= 1000 ? (meters / 1000).toFixed(1) + ' km' : Math.round(meters) + ' m';
  const formatDur = (sec: number) => {
    const mins = Math.max(1, Math.round(sec / 60));
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hrs} hr ${rem} min` : `${hrs} hr`;
  };

  const destTitle = destination.name ?? 'Destination';
  const midPoint = {
    latitude: (origin.latitude + destination.latitude) / 2,
    longitude: (origin.longitude + destination.longitude) / 2,
  };

  const polyline = [
    { latitude: origin.latitude, longitude: origin.longitude },
    midPoint,
    { latitude: destination.latitude, longitude: destination.longitude },
  ];

  return {
    id: 'route-direct-estimate',
    name: 'Direct estimated route',
    distance: formatDist(roadDistanceMeters),
    duration: formatDur(durationSeconds),
    durationSeconds,
    trafficCondition: 'unknown',
    summary: 'Direct route estimate',
    viaRoute: 'Direct road estimate (Google Routes API fallback)',
    isRecommended: true,
    polylinePoints: polyline.map((p) => ({ x: 0, y: 0, latitude: p.latitude, longitude: p.longitude })),
    googlePath: polyline,
    instructions: [
      {
        id: 'fb-step-1',
        stepNumber: 1,
        maneuver: 'straight',
        instruction: `Head toward ${destTitle}`,
        streetName: 'Main road',
        distanceToNext: formatDist(Math.round(roadDistanceMeters * 0.4)),
        remainingTime: formatDur(durationSeconds),
        remainingDistance: formatDist(roadDistanceMeters),
      },
      {
        id: 'fb-step-2',
        stepNumber: 2,
        maneuver: 'straight',
        instruction: `Continue toward ${destTitle}`,
        streetName: destTitle,
        distanceToNext: formatDist(Math.round(roadDistanceMeters * 0.6)),
        remainingTime: formatDur(Math.round(durationSeconds * 0.6)),
        remainingDistance: formatDist(Math.round(roadDistanceMeters * 0.6)),
      },
      {
        id: 'fb-step-3',
        stepNumber: 3,
        maneuver: 'arrive',
        instruction: `Arrive at ${destTitle}`,
        streetName: destTitle,
        distanceToNext: '0 m',
        remainingTime: '0 min',
        remainingDistance: '0 m',
      },
    ],
  };
};

export interface MapRouteOptions {
  customOrigin?: { latitude: number; longitude: number } | null;
  customDestination?: { latitude: number; longitude: number; name?: string; address?: string } | null;
}

export function useMapRoute(
  facility: Facility | null,
  location: UserLocation | null,
  options?: MapRouteOptions,
) {
  const origin = options?.customOrigin
    && Number.isFinite(options.customOrigin.latitude) && options.customOrigin.latitude >= -90 && options.customOrigin.latitude <= 90
    && Number.isFinite(options.customOrigin.longitude) && options.customOrigin.longitude >= -180 && options.customOrigin.longitude <= 180
    ? { latitude: options.customOrigin.latitude, longitude: options.customOrigin.longitude }
    : location
      && Number.isFinite(location.latitude) && location.latitude >= -90 && location.latitude <= 90
      && Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 180
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;

  const facilityLat = facility?.latitude;
  const facilityLng = facility?.longitude;
  const hasFacilityCoords = typeof facilityLat === 'number'
    && Number.isFinite(facilityLat) && facilityLat >= -90 && facilityLat <= 90
    && typeof facilityLng === 'number'
    && Number.isFinite(facilityLng) && facilityLng >= -180 && facilityLng <= 180;

  // Fallback geocoding if facility coordinates are missing
  const geocodeFacilityQuery = useQuery({
    queryKey: ['geocode-facility-destination', facility?.id, facility?.name, facility?.address],
    queryFn: () => mapsApi.geocode([facility?.name, facility?.address].filter(Boolean).join(', ')),
    enabled: Boolean(facility && !hasFacilityCoords && (facility?.address || facility?.name) && !options?.customDestination),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const geocodedCoords = geocodeFacilityQuery.data
    ? { latitude: geocodeFacilityQuery.data.latitude, longitude: geocodeFacilityQuery.data.longitude }
    : null;

  const destination = options?.customDestination
    ? { latitude: options.customDestination.latitude, longitude: options.customDestination.longitude, name: options.customDestination.name }
    : hasFacilityCoords
      ? { latitude: facilityLat, longitude: facilityLng, name: facility?.name }
      : geocodedCoords
        ? { latitude: geocodedCoords.latitude, longitude: geocodedCoords.longitude, name: facility?.name }
        : null;

  const query = useQuery({
    queryKey: ['google-route', origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude],
    queryFn: () => mapsApi.route({
      origin: { latitude: origin!.latitude, longitude: origin!.longitude },
      destination: { latitude: destination!.latitude, longitude: destination!.longitude },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    }),
    enabled: Boolean(origin && destination),
    staleTime: 30_000,
    retry: retryTransientFailure,
  });

  const isFallback = Boolean(query.data?.isFallback) || (!query.data?.routes?.length && Boolean(origin && destination) && (query.isError || !query.isLoading));

  const routes = useMemo(() => {
    if (query.data?.routes?.length) {
      return query.data.routes.map(toRouteItem);
    }
    if (origin && destination && (query.isError || !query.isLoading)) {
      return [calculateDirectRoute(origin, destination)];
    }
    return [];
  }, [query.data, query.isError, query.isLoading, origin, destination]);

  return {
    ...query,
    routes,
    origin,
    destination,
    isFallback,
    isGeocodingFacility: geocodeFacilityQuery.isLoading,
  };
}
