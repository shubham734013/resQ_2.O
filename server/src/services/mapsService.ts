import { AppError } from '../utils/AppError.js';
import type { z } from 'zod';
import type { routeRequestSchema } from '../schemas/maps.js';

type RouteInput = z.infer<typeof routeRequestSchema>;

interface GoogleRoute {
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;
  description?: string;
  polyline?: { encodedPolyline?: string };
}

interface GoogleRoutesResponse { routes?: GoogleRoute[]; }

const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    latitude += (result & 1) ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    longitude += (result & 1) ? ~(result >> 1) : result >> 1;

    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return points;
};

const secondsFromDuration = (value?: string): number => {
  const match = value?.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : 0;
};

const trafficCondition = (durationSeconds: number, staticSeconds: number): 'LIGHT' | 'MODERATE' | 'HEAVY' | 'UNKNOWN' => {
  if (!durationSeconds || !staticSeconds) return 'UNKNOWN';
  const ratio = durationSeconds / staticSeconds;
  if (ratio >= 1.2) return 'HEAVY';
  if (ratio >= 1.05) return 'MODERATE';
  return 'LIGHT';
};

const formatDistance = (meters: number): string => meters >= 1000 ? (meters / 1000).toFixed(1) + ' km' : Math.round(meters) + ' m';
const formatDuration = (seconds: number): string => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return minutes + ' min';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? hours + ' hr ' + remainder + ' min' : hours + ' hr';
};

export const calculateGoogleRoutes = async (input: RouteInput) => {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!apiKey) throw new AppError('MAPS_API_KEY_MISSING', 'Server-side Google Maps key is not configured', 503);

  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.staticDuration,routes.description,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: input.origin.latitude, longitude: input.origin.longitude } } },
      destination: { location: { latLng: { latitude: input.destination.latitude, longitude: input.destination.longitude } } },
      travelMode: input.travelMode,
      routingPreference: input.travelMode === 'DRIVE' || input.travelMode === 'TWO_WHEELER' ? input.routingPreference : undefined,
      computeAlternativeRoutes: true,
      languageCode: 'en-US',
      units: 'METRIC',
    }),
  });

  const payload = await response.json().catch(() => null) as GoogleRoutesResponse | null;
  if (!response.ok) throw new AppError('ROUTE_REQUEST_FAILED', 'Google could not calculate a route right now', 502);
  if (!payload?.routes?.length) throw new AppError('ROUTE_NOT_FOUND', 'No route was found between the selected locations', 404);

  const routes = payload.routes.map((route, index) => {
    const distanceMeters = route.distanceMeters ?? 0;
    const durationSeconds = secondsFromDuration(route.duration);
    const staticSeconds = secondsFromDuration(route.staticDuration);
    return {
      id: 'google-route-' + index,
      distanceMeters,
      durationSeconds,
      distanceText: formatDistance(distanceMeters),
      durationText: formatDuration(durationSeconds),
      polyline: decodePolyline(route.polyline?.encodedPolyline ?? ''),
      summary: route.description ?? 'Google route',
      trafficCondition: trafficCondition(durationSeconds, staticSeconds),
      recommended: index === 0,
    };
  });

  return {
    routes,
    origin: input.origin,
    destination: input.destination,
    fetchedAt: new Date().toISOString(),
  };
};