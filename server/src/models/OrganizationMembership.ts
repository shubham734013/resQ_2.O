import { Schema, model, Types, type Document } from 'mongoose';

export const MEMBERSHIP_PRINCIPAL_TYPES = ['HOSPITAL', 'AMBULANCE_PROVIDER', 'AMBULANCE_DRIVER'] as const;
export type MembershipPrincipalType = (typeof MEMBERSHIP_PRINCIPAL_TYPES)[number];

export const MEMBERSHIP_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MEMBERSHIP_ROLES = [
  'ORG_ADMIN',
  'ORG_MEMBER',
  'HOSPITAL_ADMIN',
  'PROVIDER_ADMIN',
  'DISPATCHER',
  'DRIVER',
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export interface OrganizationMembershipDocument extends Document {
  organizationId: Types.ObjectId;
  principalType: MembershipPrincipalType;
  principalId: Types.ObjectId;
  role: MembershipRole;
  permissions: string[];
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const organizationMembershipSchema = new Schema<OrganizationMembershipDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    principalType: { type: String, enum: MEMBERSHIP_PRINCIPAL_TYPES, required: true },
    principalId: { type: Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, enum: MEMBERSHIP_ROLES, default: 'ORG_MEMBER' },
    permissions: { type: [String], default: [] },
    status: { type: String, enum: MEMBERSHIP_STATUSES, default: 'ACTIVE', index: true },
  },
  { timestamps: true }
);

// Unique compound index: prevent duplicate active or archived memberships for the same principal in an org
organizationMembershipSchema.index({ organizationId: 1, principalType: 1, principalId: 1 }, { unique: true });
// Fast lookup index: find all active memberships of a principal
organizationMembershipSchema.index({ principalType: 1, principalId: 1, status: 1 });

export const OrganizationMembershipModel = model<OrganizationMembershipDocument>(
  'OrganizationMembership',
  organizationMembershipSchema,
  'OrganizationMemberships'
);
