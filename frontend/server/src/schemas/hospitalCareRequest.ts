import { z } from 'zod';
import { CARE_REQUEST_TYPES, CARE_REQUEST_STATUSES, PREFERRED_TIMINGS, CONTACT_PREFERENCES } from '../models/HospitalCareRequest.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;

export const createCareRequestSchema = z.object({
  hospitalId: z.string().regex(objectIdRegex, 'Invalid hospital ID format'),
  serviceDepartment: z.string().trim().min(2, 'Department name must be at least 2 characters').max(100),
  requestType: z.enum(CARE_REQUEST_TYPES),
  visitReason: z.string().trim().min(3, 'Reason for visit must be at least 3 characters').max(1000),
  preferredTiming: z.enum(PREFERRED_TIMINGS).default('FLEXIBLE'),
  contactPreference: z.enum(CONTACT_PREFERENCES).default('IN_APP'),
});

export const respondCareRequestSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
  notes: z.string().trim().max(1000).optional(),
  rejectionReason: z.string().trim().max(1000).optional(),
}).refine(
  (data) => data.action !== 'REJECT' || (typeof data.rejectionReason === 'string' && data.rejectionReason.trim().length > 0),
  { message: 'A rejection reason is required when rejecting a request', path: ['rejectionReason'] }
);

export const cancelCareRequestSchema = z.object({
  cancellationReason: z.string().trim().max(500).optional(),
});

export const listCareRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(CARE_REQUEST_STATUSES).optional(),
  serviceDepartment: z.string().trim().optional(),
});
