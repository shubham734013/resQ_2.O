import { z } from 'zod';

export const facilitySearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(['all', 'emergency', 'trauma', 'urgent_care', 'pediatric']).default('all'),
  emergencyOnly: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();