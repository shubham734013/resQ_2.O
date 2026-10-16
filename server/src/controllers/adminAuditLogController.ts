import type { Request, Response } from 'express';
import { AuditLogModel } from '../models/AuditLog.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const listAuditLogsController = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const skip = (page - 1) * limit;
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
  const actorRole = typeof req.query.actorRole === 'string' ? req.query.actorRole : undefined;
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;

  const filter: Record<string, unknown> = {};
  if (entityType) filter['entityType'] = entityType;
  if (actorRole) filter['actorRole'] = actorRole;
  if (action) filter['action'] = { $regex: action, $options: 'i' };

  const [items, total] = await Promise.all([
    AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
    AuditLogModel.countDocuments(filter).exec(),
  ]);

  sendSuccess(res, {
    items: items.map((log) => ({
      id: String(log._id),
      actorId: log.actorId ? String(log.actorId) : null,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: String(log.entityId),
      reason: log.reason ?? null,
      createdAt: log.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};
