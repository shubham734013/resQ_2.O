import { z } from 'zod';
import { HOSPITAL_EMERGENCY_STATUSES } from '../models/EmergencyRequest.js';
import { HOSPITAL_PATIENT_STATUSES as PATIENT_STATUSES } from '../models/HospitalPatient.js';

const coordinate = z.number().finite().min(-180).max(180);

export const hospitalProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  latitude: coordinate.min(-90).max(90).optional(),
  longitude: coordinate.optional(),
  hospitalType: z.string().trim().min(2).max(100).optional(),
  publicContactInformation: z.string().trim().max(500).optional(),
  emergencyAvailability: z.enum(['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN']).optional(),
  operationalDescription: z.string().trim().max(1000).optional(),
}).strict();

const stringList = z.array(z.string().trim().min(1).max(100)).max(50);

export const hospitalServicesUpdateSchema = z.object({ services: stringList }).strict();
export const hospitalCapabilitiesUpdateSchema = z.object({ capabilities: stringList }).strict();

export const hospitalAvailabilityUpdateSchema = z.object({
  emergencyAvailability: z.enum(['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN']),
}).strict();

const resourceRecord = z.record(z.string().trim().min(1).max(100), z.number().finite().min(0).max(1000000));

export const hospitalResourcesUpdateSchema = z.object({ resourceSummary: resourceRecord }).strict();

export const hospitalEmergencyListQuerySchema = z.object({
  status: z.enum(HOSPITAL_EMERGENCY_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  situationType: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict().refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'from must be before to' });

export const hospitalPatientListQuerySchema = z.object({
  status: z.enum(PATIENT_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict().refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'from must be before to' });

export const hospitalAmbulanceListQuerySchema = z.object({
  status: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE', 'MAINTENANCE']).optional(),
  provider: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid provider id').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();

export const hospitalEmergencyStatusUpdateSchema = z.object({
  status: z.enum(HOSPITAL_EMERGENCY_STATUSES),
}).strict();
