import { Types } from 'mongoose';
import { AuditLogModel, type AuditActorRole, type AuditEntityType } from '../models/AuditLog.js';

export interface AuditLogInput {
  actorId?: string;
  actorRole: AuditActorRole;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason?: string;
  requestMetadata?: { ip?: string; userAgent?: string };
}

const toObjectId = (value: string | undefined, field: string): Types.ObjectId | undefined => {
  if (!value) return undefined;
  if (!Types.ObjectId.isValid(value)) throw new Error(`Invalid ${field} for audit log`);
  return new Types.ObjectId(value);
};

export const recordAuditLog = async (input: AuditLogInput): Promise<void> => {
  const entityId = toObjectId(input.entityId, 'entityId');
  if (!entityId) throw new Error('Audit entityId is required');
  await AuditLogModel.create({
    actorId: toObjectId(input.actorId, 'actorId'),
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId,
    previousState: input.previousState,
    newState: input.newState,
    reason: input.reason,
    requestMetadata: input.requestMetadata,
  });
};
