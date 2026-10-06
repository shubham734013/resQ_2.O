import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import type { z } from 'zod';
import type { routeRequestSchema } from '../schemas/maps.js';

type RouteInput = z.infer<typeof routeRequestSchema>;

interface OrsStep {
  distance?: number;
  duration?: number;
  instruction?: string;
  name?: string;
  type?: number;
}
interface OrsSegment { steps?: OrsStep[] }
interface OrsRoute {
  summary?: { distance?: number; duration?: number };
  geometry?: string;
  segments?: OrsSegment[];
}
interface OrsResponse { routes?: OrsRoute[] }

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

const formatDistance = (meters: number): string =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;

const formatDuration = (seconds: number): string => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
};

const maneuver = (
  type?: number,
): 'straight' | 'turn-right' | 'turn-left' | 'slight-right' | 'slight-left' | 'u-turn' | 'arrive' => {
  switch (type) {
    case 0:
    case 2:
      return 'turn-left';
    case 1:
    case 3:
      return 'turn-right';
    case 4:
      return 'slight-left';
    case 5:
      return 'slight-right';
    case 9:
      return 'u-turn';
    case 10:
      return 'arrive';
    default:
      return 'straight';
  }
};

const profileFor = (travelMode: RouteInput['travelMode']): string => {
  switch (travelMode) {
    case 'WALK':
      return 'foot-walking';
    case 'BICYCLE':
      return 'cycling-regular';
    case 'TWO_WHEELER':
    case 'DRIVE':
    default:
      return 'driving-car';
  }
};

export const calculateOpenStreetMapRoute = async (input: RouteInput) => {
  const apiKey = env.OPENROUTESERVICE_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(
      'ROUTING_API_KEY_MISSING',
      'OpenRouteService routing key is not configured on the server',
      503,
    );
  }

  const profile = profileFor(input.travelMode);
  const baseUrl = env.OPENROUTESERVICE_BASE_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/v2/directions/${profile}/json`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      coordinates: [
        [input.origin.longitude, input.origin.latitude],
        [input.destination.longitude, input.destination.latitude],
      ],
      instructions: true,
      units: 'm',
      language: 'en',
      alternative_routes: {
        target_count: 2,
        share_factor: 0.6,
        weight_factor: 1.4,
      },
    }),
  });

  const payload = await response.json().catch(() => null) as OrsResponse | null;
  if (!response.ok) {
    throw new AppError(
      'ROUTE_REQUEST_FAILED',
      'OpenStreetMap routing service could not calculate a route right now',
      502,
    );
  }
  if (!payload?.routes?.length) {
    throw new AppError(
      'ROUTE_NOT_FOUND',
      'No route was found between the selected locations',
      404,
    );
  }

  const routes = payload.routes.map((route, index) => {
    const distanceMeters = Number(route.summary?.distance ?? 0);
    const durationSeconds = Number(route.summary?.duration ?? 0);
    const steps = route.segments?.flatMap((segment) => segment.steps ?? []) ?? [];
    let remainingSeconds = durationSeconds;
    let remainingMeters = distanceMeters;

    const instructions = steps.map((step, stepIndex) => {
      const stepMeters = Number(step.distance ?? 0);
      if (stepIndex > 0) {
        remainingMeters = Math.max(0, remainingMeters - Number(steps[stepIndex - 1]?.distance ?? 0));
        remainingSeconds = Math.max(0, remainingSeconds - Number(steps[stepIndex - 1]?.duration ?? 0));
      }

      return {
        id: `step-${index}-${stepIndex}`,
        stepNumber: stepIndex + 1,
        maneuver: maneuver(step.type),
        instruction: step.instruction ?? 'Continue',
        streetName: step.name ?? 'Route',
        distanceToNext: formatDistance(stepMeters),
        remainingTime: formatDuration(remainingSeconds),
        remainingDistance: formatDistance(remainingMeters),
      };
    });

    return {
      id: `osm-route-${index}`,
      distanceMeters,
      durationSeconds,
      distanceText: formatDistance(distanceMeters),
      durationText: formatDuration(durationSeconds),
      polyline: decodePolyline(route.geometry ?? ''),
      summary: steps[0]?.name ? `via ${steps[0].name}` : 'OpenStreetMap road network',
      trafficCondition: 'UNKNOWN' as const,
      recommended: index === 0,
      instructions,
    };
  });

  return {
    routes,
    origin: input.origin,
    destination: input.destination,
    fetchedAt: new Date().toISOString(),
  };
};
