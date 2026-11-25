import { z } from 'zod';
import { HOSPITAL_EMERGENCY_STATUSES } from '../models/EmergencyRequest.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
export const EMERGENCY_CATEGORY_IDS = ['accident_injury', 'severe_bleeding', 'breathing_difficulty', 'chest_pain', 'stroke_symptoms', 'unconscious_person', 'burn', 'other'] as const;
export const EMERGENCY_SITUATION_LABELS = ['Accident / Injury', 'Severe Bleeding', 'Breathing Difficulty', 'Chest Pain', 'Stroke-like Symptoms', 'Unconscious Person', 'Burn', 'Other Acute Situation'] as const;
const date = z.string().datetime().transform((value) => new Date(value));

export const createEmergencyRequestSchema = z.object({
  hospitalId: objectId,
  situationType: z.string().trim().min(2).max(120),
  category: z.enum(EMERGENCY_CATEGORY_IDS).optional(),
  location: z.string().trim().min(2).max(300).optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict().superRefine((value, ctx) => {
  const labelIndex = EMERGENCY_SITUATION_LABELS.indexOf(value.situationType as (typeof EMERGENCY_SITUATION_LABELS)[number]);
  if (value.category && labelIndex >= 0 && value.category !== EMERGENCY_CATEGORY_IDS[labelIndex]) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['category'], message: 'category must match situationType' });
  }
});

export const emergencyDiscoveryQuerySchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  category: z.enum(EMERGENCY_CATEGORY_IDS),
  radiusMeters: z.coerce.number().int().min(100).max(100000).default(30000),
  limit: z.coerce.number().int().min(1).max(10).default(10),
  includeRoutes: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
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
