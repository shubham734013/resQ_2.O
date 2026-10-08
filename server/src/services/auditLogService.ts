import { Types } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';
import type { Role } from '../types/roles.js';

export interface AuditLogInput {
  actorId?: string;
  actorRole: Role | 'SYSTEM';
  action: string;
  entityType: string;
  entityId?: string;
  previousState?: unknown;
  newState?: unknown;
  reason?: string;
  requestMetadata?: Record<string, string | number | boolean | null>;
}

const objectIdOrUndefined = (value?: string) =>
  value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;

export const recordAuditLog = async (input: AuditLogInput): Promise<void> => {
  await AuditLogModel.create({
    actorId: objectIdOrUndefined(input.actorId),
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: objectIdOrUndefined(input.entityId),
    previousState: input.previousState,
    newState: input.newState,
    reason: input.reason,
    requestMetadata: input.requestMetadata,
  });
};
