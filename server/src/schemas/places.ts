import { z } from 'zod';

export const placeSearchSchema = z.object({
  query: z.string().trim().min(2).max(200),
}).strict();
