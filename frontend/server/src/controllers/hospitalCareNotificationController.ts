import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/hospitalCareNotificationService.js';
import { AppError } from '../utils/AppError.js';

export const listUserNotificationsController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.auth?.id) throw new AppError('UNAUTHORIZED', 'Authentication is required', 401);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const unreadOnly = req.query.unreadOnly === 'true';
  const result = await service.listNotificationsForRecipient('USER', req.auth.id, { page, limit, unreadOnly });
  sendSuccess(res, result);
};

export const markUserNotificationReadController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.auth?.id) throw new AppError('UNAUTHORIZED', 'Authentication is required', 401);
  const notificationId = req.params.id;
  if (typeof notificationId !== 'string' || !notificationId) {
    throw new AppError('INVALID_ID', 'Notification ID is required', 400);
  }
  const result = await service.markNotificationAsRead(notificationId, req.auth.id);
  sendSuccess(res, result);
};

export const listHospitalNotificationsController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.auth?.id || req.auth.role !== 'HOSPITAL') {
    throw new AppError('FORBIDDEN', 'Hospital authentication is required', 403);
  }
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const unreadOnly = req.query.unreadOnly === 'true';
  const result = await service.listNotificationsForRecipient('HOSPITAL', req.auth.id, { page, limit, unreadOnly });
  sendSuccess(res, result);
};

export const markHospitalNotificationReadController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.auth?.id || req.auth.role !== 'HOSPITAL') {
    throw new AppError('FORBIDDEN', 'Hospital authentication is required', 403);
  }
  const notificationId = req.params.id;
  if (typeof notificationId !== 'string' || !notificationId) {
    throw new AppError('INVALID_ID', 'Notification ID is required', 400);
  }
  const result = await service.markNotificationAsRead(notificationId, req.auth.id);
  sendSuccess(res, result);
};
