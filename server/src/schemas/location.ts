import { z } from 'zod';

export const locationUpdateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(10000),
  timestamp: z.coerce.number().int().positive().max(Date.now() + 5 * 60 * 1000),
}).strict();
