import { z } from 'zod';
import { ACCOUNT_STATUSES, ROLES, VERIFICATION_STATUSES } from '../types/roles.js';
import { AMBULANCE_STATUSES } from '../models/Ambulance.js';
import { DRIVER_AVAILABILITY_STATUSES } from '../models/AmbulanceDriver.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
};

export const userListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  role: z.enum(ROLES).optional(),
  city: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'email', 'role', 'accountStatus']).default('createdAt'),
  ...pagination,
}).refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'from must be before to' });

export const hospitalListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  verification: z.enum(VERIFICATION_STATUSES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  city: z.string().trim().max(100).optional(),
  hospitalType: z.string().trim().max(100).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'city', 'verificationStatus', 'accountStatus']).default('createdAt'),
  ...pagination,
});

export const providerListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  verification: z.enum(VERIFICATION_STATUSES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  city: z.string().trim().max(100).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'city', 'verificationStatus', 'accountStatus']).default('createdAt'),
  ...pagination,
});

export const ambulanceListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  currentStatus: z.enum(AMBULANCE_STATUSES).optional(),
  verification: z.enum(VERIFICATION_STATUSES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  provider: objectId.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'registrationNumber', 'vehicleNumber', 'currentStatus', 'verificationStatus', 'accountStatus']).default('createdAt'),
  ...pagination,
});

export const driverListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  verification: z.enum(VERIFICATION_STATUSES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  availability: z.enum(DRIVER_AVAILABILITY_STATUSES).optional(),
  provider: objectId.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'fullName', 'email', 'licenseVerificationStatus', 'availabilityStatus', 'accountStatus']).default('createdAt'),
  ...pagination,
});

export const accountStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED']) });
export const verificationStatusSchema = z.object({ verificationStatus: z.enum(VERIFICATION_STATUSES) });
