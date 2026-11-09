import { Types } from 'mongoose';
import {
  HospitalCareNotificationModel,
  type HospitalCareNotificationType,
  type HospitalCareNotificationDocument,
} from '../models/HospitalCareNotification.js';
import { broadcastEvent } from './realtimeService.js';
import { AppError } from '../utils/AppError.js';

interface CreateCareNotificationInput {
  recipientType: 'USER' | 'HOSPITAL';
  recipientId: Types.ObjectId | string;
  careRequestId?: Types.ObjectId | string;
  appointmentId?: Types.ObjectId | string;
  type: HospitalCareNotificationType;
  title: string;
  message: string;
}

export const createAndDispatchCareNotification = async (
  input: CreateCareNotificationInput
): Promise<HospitalCareNotificationDocument> => {
  const recipientObjectId = typeof input.recipientId === 'string' ? new Types.ObjectId(input.recipientId) : input.recipientId;
  const careRequestObjectId = input.careRequestId ? (typeof input.careRequestId === 'string' ? new Types.ObjectId(input.careRequestId) : input.careRequestId) : undefined;
  const appointmentObjectId = input.appointmentId ? (typeof input.appointmentId === 'string' ? new Types.ObjectId(input.appointmentId) : input.appointmentId) : undefined;

  const doc = await HospitalCareNotificationModel.create({
    recipientType: input.recipientType,
    recipientId: recipientObjectId,
    careRequestId: careRequestObjectId,
    appointmentId: appointmentObjectId,
    type: input.type,
    title: input.title,
    message: input.message,
    status: 'UNREAD',
  });

  // Realtime emission: user:<userId> or hospital:<hospitalId>
  const channel = input.recipientType === 'USER' ? `user:${recipientObjectId.toString()}` : `hospital:${recipientObjectId.toString()}`;
  broadcastEvent(channel, 'notification:received', {
    id: doc._id.toString(),
    recipientType: input.recipientType,
    recipientId: recipientObjectId.toString(),
    type: input.type,
    title: input.title,
    message: input.message,
    careRequestId: careRequestObjectId?.toString(),
    appointmentId: appointmentObjectId?.toString(),
    createdAt: doc.createdAt.toISOString(),
  });

  return doc;
};

export const listNotificationsForRecipient = async (
  recipientType: 'USER' | 'HOSPITAL',
  recipientId: string,
  options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
) => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const filter: Record<string, unknown> = {
    recipientType,
    recipientId: new Types.ObjectId(recipientId),
  };
  if (options.unreadOnly) {
    filter.status = 'UNREAD';
  }

  const [items, total] = await Promise.all([
    HospitalCareNotificationModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    HospitalCareNotificationModel.countDocuments(filter).exec(),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      _id: item._id.toString(),
      recipientId: item.recipientId.toString(),
      careRequestId: item.careRequestId?.toString(),
      appointmentId: item.appointmentId?.toString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: total ? Math.ceil(total / limit) : 0,
    },
  };
};

export const markNotificationAsRead = async (
  notificationId: string,
  recipientId: string
) => {
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new AppError('INVALID_ID', 'Invalid notification id', 400);
  }

  const updated = await HospitalCareNotificationModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(notificationId),
      recipientId: new Types.ObjectId(recipientId),
    },
    {
      $set: { status: 'READ', readAt: new Date() },
    },
    { returnDocument: 'after' }
  ).lean().exec();

  if (!updated) {
    throw new AppError('NOT_FOUND', 'Notification not found or access denied', 404);
  }

  return {
    ...updated,
    _id: updated._id.toString(),
    recipientId: updated.recipientId.toString(),
  };
};
