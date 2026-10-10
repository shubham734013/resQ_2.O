import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import type { z } from 'zod';
import type { routeRequestSchema } from '../schemas/maps.js';

type RouteInput = z.infer<typeof routeRequestSchema>;

interface GoogleStep {
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;
  navigationInstruction?: { instructions?: string; maneuver?: string };
  localizedValues?: { distance?: { text?: string }; duration?: { text?: string } };
}
interface GoogleRoute {
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;
  description?: string;
  polyline?: { encodedPolyline?: string };
  legs?: Array<{ steps?: GoogleStep[] }>;
}
interface GoogleRoutesResponse extends GoogleApiErrorPayload { routes?: GoogleRoute[]; }
interface GoogleApiErrorPayload {
  error?: {
    status?: string;
    message?: string;
    details?: Array<{ reason?: string; metadata?: Record<string, unknown> }>;
  };
}

export const describeGoogleRoutesFailure = (httpStatus: number, payload: GoogleApiErrorPayload | null): { code: string; message: string; statusCode: number } => {
  const googleStatus = payload?.error?.status?.toUpperCase() ?? '';
  const reasons = (payload?.error?.details ?? []).map((detail) => String(detail.reason ?? '')).join(' ').toUpperCase();

  if (httpStatus === 401 || httpStatus === 403 || googleStatus === 'PERMISSION_DENIED' || /API_KEY|SERVICE_DISABLED|BILLING/.test(reasons)) {
    return {
      code: 'ROUTES_API_CONFIGURATION_ERROR',
      message: 'Google Routes API rejected the server key. Check that Routes API is enabled, billing is active, and the server key is allowed to use Routes API.',
      statusCode: 502,
    };
  }
  if (httpStatus === 429 || googleStatus === 'RESOURCE_EXHAUSTED') {
    return {
      code: 'ROUTES_API_QUOTA_EXCEEDED',
      message: 'Google Routes API quota or rate limit was reached. Check Google Cloud quotas and billing, then retry.',
      statusCode: 503,
    };
  }
  if (httpStatus === 400 || googleStatus === 'INVALID_ARGUMENT') {
    return {
      code: 'ROUTES_API_INVALID_REQUEST',
      message: 'Google Routes API rejected the route request. Check the selected travel mode and origin/destination coordinates.',
      statusCode: 400,
    };
  }
  return {
    code: 'ROUTE_PROVIDER_UNAVAILABLE',
    message: 'Google Routes could not calculate a route right now. Check server connectivity and Google Maps Platform status, then retry.',
    statusCode: 502,
  };
};


const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latitude += (result & 1) ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
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

const maneuver = (value?: string): 'straight' | 'turn-right' | 'turn-left' | 'slight-right' | 'slight-left' | 'u-turn' | 'arrive' => {
  const normalized = (value ?? '').toUpperCase();
  if (normalized.includes('UTURN')) return 'u-turn';
  if (normalized.includes('RIGHT')) return normalized.includes('SLIGHT') ? 'slight-right' : 'turn-right';
  if (normalized.includes('LEFT')) return normalized.includes('SLIGHT') ? 'slight-left' : 'turn-left';
  if (normalized.includes('ARRIVE') || normalized.includes('DESTINATION')) return 'arrive';
  return 'straight';
};

export const calculateGoogleRoutes = async (input: RouteInput) => {
  const apiKey = (env.GOOGLE_ROUTES_API_KEY || env.GOOGLE_MAPS_SERVER_API_KEY)?.trim();
  if (!apiKey) throw new AppError('MAPS_API_KEY_MISSING', 'Server-side Google Maps key is not configured', 503);

  let response: Response;
  try {
    response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.staticDuration,routes.description,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.localizedValues',
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
  } catch {
    throw new AppError('ROUTE_PROVIDER_UNAVAILABLE', 'Google Routes could not be reached. Check backend internet access and retry.', 502);
  }

  const payload = await response.json().catch(() => null) as GoogleRoutesResponse | null;
  if (!response.ok) {
    const failure = describeGoogleRoutesFailure(response.status, payload);
    throw new AppError(failure.code, failure.message, failure.statusCode);
  }
  if (!payload?.routes?.length) throw new AppError('ROUTE_NOT_FOUND', 'No route was found between the selected locations', 404);

  const routes = payload.routes.map((route, index) => {
    const distanceMeters = route.distanceMeters ?? 0;
    const durationSeconds = secondsFromDuration(route.duration);
    const staticSeconds = secondsFromDuration(route.staticDuration);
    const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
    let remainingSeconds = durationSeconds;
    let remainingMeters = distanceMeters;
    const instructions = steps.map((step, stepIndex) => {
      const stepMeters = step.distanceMeters ?? 0;
      const previousStep = stepIndex > 0 ? steps[stepIndex - 1] : undefined;
      const stepDuration = previousStep?.staticDuration || previousStep?.duration;
      remainingSeconds = Math.max(0, remainingSeconds - secondsFromDuration(stepDuration));
      remainingMeters = Math.max(0, remainingMeters - (previousStep?.distanceMeters ?? 0));
      return {
        id: 'step-' + index + '-' + stepIndex,
        stepNumber: stepIndex + 1,
        maneuver: maneuver(step.navigationInstruction?.maneuver),
        instruction: step.navigationInstruction?.instructions ?? 'Continue',
        streetName: step.navigationInstruction?.instructions ?? 'Route',
        distanceToNext: step.localizedValues?.distance?.text ?? formatDistance(stepMeters),
        remainingTime: formatDuration(Math.max(0, remainingSeconds)),
        remainingDistance: formatDistance(Math.max(0, remainingMeters)),
      };
    });

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
      instructions,
    };
  });

  return { routes, origin: input.origin, destination: input.destination, fetchedAt: new Date().toISOString() };
};