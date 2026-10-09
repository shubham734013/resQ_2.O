import { z } from 'zod';

export const facilitySearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(['all', 'emergency', 'trauma', 'urgent_care', 'pediatric']).default('all'),
  emergencyOnly: z.coerce.boolean().default(false),
  latitude: z.coerce.number().finite().min(-90).max(90).optional(),
  longitude: z.coerce.number().finite().min(-180).max(180).optional(),
  radiusMeters: z.coerce.number().int().min(100).max(100000).default(50000),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((value, ctx) => {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['latitude'], message: 'latitude and longitude must be provided together' });
  }
});
