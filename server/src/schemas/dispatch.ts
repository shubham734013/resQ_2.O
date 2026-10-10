import { z } from 'zod';
import { DISPATCH_JOB_STATUSES } from '../models/DispatchJob.js';

export const dispatchAdminQuerySchema = z.object({
  status: z.enum(DISPATCH_JOB_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const dispatchManualAssignSchema = z.object({
  driverId: z.string().regex(/^[a-f\\d]{24}$/i, 'driverId must be a MongoDB ObjectId'),
}).strict();

export const dispatchEscalateSchema = z.object({
  reason: z.string().trim().min(3).max(500),
}).strict();
