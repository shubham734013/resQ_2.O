import { Schema, model, type Document } from 'mongoose';

export const ORGANIZATION_TYPES = ['HOSPITAL_NETWORK', 'AMBULANCE_OPERATOR'] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORGANIZATION_STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export interface OrganizationDocument extends Document {
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ORGANIZATION_TYPES, required: true, index: true },
    status: { type: String, enum: ORGANIZATION_STATUSES, default: 'ACTIVE', index: true },
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    description: { type: String, trim: true },
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

organizationSchema.index({ type: 1, status: 1 });
organizationSchema.index({ name: 1 });

export const OrganizationModel = model<OrganizationDocument>('Organization', organizationSchema, 'Organizations');
