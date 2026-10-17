import { z } from 'zod';
import { ORGANIZATION_TYPES, ORGANIZATION_STATUSES } from '../models/Organization.js';
import { MEMBERSHIP_PRINCIPAL_TYPES, MEMBERSHIP_STATUSES, MEMBERSHIP_ROLES } from '../models/OrganizationMembership.js';

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(ORGANIZATION_TYPES),
  status: z.enum(ORGANIZATION_STATUSES).optional().default('ACTIVE'),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(6).max(20).optional(),
  description: z.string().max(500).optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const addMembershipSchema = z.object({
  organizationId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid organization ID'),
  principalType: z.enum(MEMBERSHIP_PRINCIPAL_TYPES),
  principalId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid principal ID'),
  role: z.enum(MEMBERSHIP_ROLES).default('ORG_MEMBER'),
  permissions: z.array(z.string()).default([]),
  status: z.enum(MEMBERSHIP_STATUSES).optional().default('ACTIVE'),
});

export const updateMembershipSchema = z.object({
  role: z.enum(MEMBERSHIP_ROLES).optional(),
  permissions: z.array(z.string()).optional(),
  status: z.enum(MEMBERSHIP_STATUSES).optional(),
});

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.input<typeof updateOrganizationSchema>;
export type AddMembershipInput = z.input<typeof addMembershipSchema>;
export type UpdateMembershipInput = z.input<typeof updateMembershipSchema>;
