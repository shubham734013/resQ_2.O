import { z } from 'zod';

export const geocodeRequestSchema = z.object({
  address: z.string().trim().min(2).max(300),
}).strict();