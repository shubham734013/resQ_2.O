import { z } from 'zod';
import { HOSPITAL_EMERGENCY_STATUSES } from '../models/EmergencyRequest.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const date = z.string().datetime().transform((value) => new Date(value));

export const createEmergencyRequestSchema = z.object({
  hospitalId: objectId,
  situationType: z.string().trim().min(2).max(120),
  location: z.string().trim().max(300).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
}).strict();

export const userEmergencyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(HOSPITAL_EMERGENCY_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  from: date.optional(),
  to: date.optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, {
  path: ['from'],
  message: 'from must be before to',
});

export const cancelEmergencySchema = z.object({
  reason: z.string().trim().max(300).optional(),
}).strict();
