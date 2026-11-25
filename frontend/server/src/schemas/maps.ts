import { z } from 'zod';

const latitude = z.coerce.number().finite().min(-90).max(90);
const longitude = z.coerce.number().finite().min(-180).max(180);

export const coordinateSchema = z.object({ latitude, longitude }).strict();

export const nearbyQuerySchema = z.object({
  latitude,
  longitude,
  radius: z.coerce.number().finite().min(100).max(100000).default(10000),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  emergencyAvailability: z.enum(['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN']).optional(),
  hospitalType: z.string().trim().max(100).optional(),
  service: z.string().trim().max(100).optional(),
  capability: z.string().trim().max(100).optional(),
}).strict();

export const routeRequestSchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  travelMode: z.enum(['DRIVE', 'TWO_WHEELER', 'WALK', 'BICYCLE']).default('DRIVE'),
  routingPreference: z.enum(['TRAFFIC_AWARE', 'TRAFFIC_AWARE_OPTIMAL', 'TRAFFIC_UNAWARE']).default('TRAFFIC_AWARE'),
}).strict();