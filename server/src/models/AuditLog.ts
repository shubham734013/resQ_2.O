import { Schema, model, Types } from 'mongoose';

export const AUDIT_ACTOR_ROLES = ['USER', 'HOSPITAL', 'AMBULANCE_PROVIDER', 'AMBULANCE_DRIVER', 'ADMIN', 'SYSTEM'] as const;
export type AuditActorRole = (typeof AUDIT_ACTOR_ROLES)[number];

export const AUDIT_ENTITY_TYPES = ['USER', 'HOSPITAL', 'AMBULANCE_PROVIDER', 'AMBULANCE', 'AMBULANCE_DRIVER', 'EMERGENCY', 'TRIP', 'HOSPITAL_PATIENT'] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export interface AuditLogDocument {
  actorId?: Types.ObjectId;
  actorRole: AuditActorRole;
  action: string;
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason?: string;
  requestMetadata?: { ip?: string; userAgent?: string };
  createdAt: Date;
}

const schema = new Schema<AuditLogDocument>({
  actorId: { type: Schema.Types.ObjectId, required: false },
  actorRole: { type: String, enum: AUDIT_ACTOR_ROLES, required: true },
  action: { type: String, required: true, trim: true, index: true },
  entityType: { type: String, required: true, enum: AUDIT_ENTITY_TYPES, index: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  previousState: { type: Schema.Types.Mixed },
  newState: { type: Schema.Types.Mixed },
  reason: { type: String, trim: true },
  requestMetadata: { ip: String, userAgent: String },
  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

schema.index({ entityType: 1, entityId: 1, createdAt: -1 });
schema.index({ actorId: 1, createdAt: -1 });

export const AuditLogModel = model<AuditLogDocument>('AuditLog', schema);
