import { Types } from 'mongoose';
import {
  HospitalCareRequestModel,
  type HospitalCareRequestDocument,
  type CareRequestType,
  type PreferredTiming,
  type ContactPreference,
  type CareRequestStatus,
} from '../models/HospitalCareRequest.js';
import { HospitalModel } from '../models/Hospital.js';
import { UserModel } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { createAndDispatchCareNotification } from './hospitalCareNotificationService.js';

const generateReferenceId = (): string => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `REQ-${datePart}-${randomPart}`;
};

export interface CreateCareRequestInput {
  hospitalId: string;
  serviceDepartment: string;
  requestType: CareRequestType;
  visitReason: string;
  preferredTiming?: PreferredTiming;
  contactPreference?: ContactPreference;
}

export const createCareRequest = async (
  userId: string,
  input: CreateCareRequestInput
): Promise<HospitalCareRequestDocument> => {
  if (!Types.ObjectId.isValid(userId)) throw new AppError('INVALID_ID', 'Invalid user id', 400);
  if (!Types.ObjectId.isValid(input.hospitalId)) throw new AppError('INVALID_ID', 'Invalid hospital id', 400);

  const [user, hospital] = await Promise.all([
    UserModel.findById(userId).lean().exec(),
    HospitalModel.findOne({
      _id: input.hospitalId,
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    }).lean().exec(),
  ]);

  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital not found or not active', 404);

  // Validate department exists in hospital services if hospital has configured services
  if (Array.isArray(hospital.services) && hospital.services.length > 0) {
    const matched = hospital.services.some(
      (s) => s.toLowerCase() === input.serviceDepartment.trim().toLowerCase()
    );
    if (!matched) {
      throw new AppError(
        'INVALID_DEPARTMENT',
        `Department '${input.serviceDepartment}' is not offered by ${hospital.name}. Available: ${hospital.services.join(', ')}`,
        400
      );
    }
  }

  const userObjectId = new Types.ObjectId(userId);
  const hospitalObjectId = new Types.ObjectId(input.hospitalId);
  const referenceId = generateReferenceId();

  const doc = await HospitalCareRequestModel.create({
    referenceId,
    userId: userObjectId,
    hospitalId: hospitalObjectId,
    serviceDepartment: input.serviceDepartment.trim(),
    requestType: input.requestType,
    visitReason: input.visitReason.trim(),
    preferredTiming: input.preferredTiming ?? 'FLEXIBLE',
    contactPreference: input.contactPreference ?? 'IN_APP',
    status: 'PENDING',
    statusHistory: [
      {
        status: 'PENDING',
        timestamp: new Date(),
        updatedBy: userObjectId,
        role: 'USER',
        reason: 'Care request initiated by citizen',
      },
    ],
  });

  // Notify hospital
  await createAndDispatchCareNotification({
    recipientType: 'HOSPITAL',
    recipientId: hospitalObjectId,
    careRequestId: doc._id,
    type: 'CARE_REQUEST_CREATED',
    title: 'New Care Request Received',
    message: `${user.name} submitted a care request for ${input.serviceDepartment} (${referenceId}).`,
  });

  return doc;
};

export const listUserCareRequests = async (
  userId: string,
  query: { page?: number; limit?: number; status?: CareRequestStatus; serviceDepartment?: string }
) => {
  if (!Types.ObjectId.isValid(userId)) throw new AppError('INVALID_ID', 'Invalid user id', 400);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
  };
  if (query.status) filter.status = query.status;
  if (query.serviceDepartment) filter.serviceDepartment = new RegExp(query.serviceDepartment, 'i');

  const [items, total] = await Promise.all([
    HospitalCareRequestModel.find(filter)
      .populate('hospitalId', 'name phone address city emergencyAvailability')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    HospitalCareRequestModel.countDocuments(filter).exec(),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: total ? Math.ceil(total / limit) : 0,
    },
  };
};

export const getUserCareRequestById = async (userId: string, requestId: string) => {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(requestId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const doc = await HospitalCareRequestModel.findOne({
    _id: new Types.ObjectId(requestId),
    userId: new Types.ObjectId(userId),
  })
    .populate('hospitalId', 'name phone address city state emergencyAvailability')
    .lean()
    .exec();

  if (!doc) throw new AppError('NOT_FOUND', 'Care request not found', 404);
  return doc;
};

export const cancelUserCareRequest = async (
  userId: string,
  requestId: string,
  cancellationReason?: string
) => {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(requestId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const existing = await HospitalCareRequestModel.findOne({
    _id: new Types.ObjectId(requestId),
    userId: new Types.ObjectId(userId),
  }).exec();

  if (!existing) throw new AppError('NOT_FOUND', 'Care request not found', 404);
  if (existing.status !== 'PENDING') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot cancel request in status '${existing.status}'. Only PENDING requests can be cancelled.`,
      400
    );
  }

  existing.status = 'CANCELLED';
  existing.cancellationReason = cancellationReason || 'Cancelled by user';
  existing.statusHistory.push({
    status: 'CANCELLED',
    timestamp: new Date(),
    updatedBy: new Types.ObjectId(userId),
    role: 'USER',
    reason: cancellationReason || 'Cancelled by citizen',
  });

  await existing.save();

  // Notify hospital
  await createAndDispatchCareNotification({
    recipientType: 'HOSPITAL',
    recipientId: existing.hospitalId,
    careRequestId: existing._id,
    type: 'CARE_REQUEST_CANCELLED',
    title: 'Care Request Cancelled',
    message: `Care request ${existing.referenceId} was cancelled by the patient.`,
  });

  return existing;
};

export const listHospitalIncomingCareRequests = async (
  hospitalId: string,
  query: { page?: number; limit?: number; status?: CareRequestStatus; serviceDepartment?: string }
) => {
  if (!Types.ObjectId.isValid(hospitalId)) throw new AppError('INVALID_ID', 'Invalid hospital id', 400);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter: Record<string, unknown> = {
    hospitalId: new Types.ObjectId(hospitalId),
  };
  if (query.status) filter.status = query.status;
  if (query.serviceDepartment) filter.serviceDepartment = new RegExp(query.serviceDepartment, 'i');

  const [items, total] = await Promise.all([
    HospitalCareRequestModel.find(filter)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    HospitalCareRequestModel.countDocuments(filter).exec(),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: total ? Math.ceil(total / limit) : 0,
    },
  };
};

export const getHospitalCareRequestById = async (hospitalId: string, requestId: string) => {
  if (!Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(requestId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const doc = await HospitalCareRequestModel.findOne({
    _id: new Types.ObjectId(requestId),
    hospitalId: new Types.ObjectId(hospitalId),
  })
    .populate('userId', 'name email phone')
    .lean()
    .exec();

  if (!doc) throw new AppError('NOT_FOUND', 'Care request not found or access denied', 404);
  return doc;
};

export const respondToCareRequest = async (
  hospitalId: string,
  requestId: string,
  input: { action: 'ACCEPT' | 'REJECT'; notes?: string; rejectionReason?: string }
) => {
  if (!Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(requestId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const existing = await HospitalCareRequestModel.findOne({
    _id: new Types.ObjectId(requestId),
    hospitalId: new Types.ObjectId(hospitalId),
  }).exec();

  if (!existing) throw new AppError('NOT_FOUND', 'Care request not found or access denied', 404);
  if (existing.status !== 'PENDING') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot respond to care request in status '${existing.status}'. Only PENDING requests can be responded to.`,
      400
    );
  }

  const hospitalObjectId = new Types.ObjectId(hospitalId);
  const now = new Date();

  if (input.action === 'ACCEPT') {
    existing.status = 'ACCEPTED';
    existing.hospitalResponse = {
      notes: input.notes,
      respondedAt: now,
      respondedBy: hospitalObjectId,
    };
    existing.statusHistory.push({
      status: 'ACCEPTED',
      timestamp: now,
      updatedBy: hospitalObjectId,
      role: 'HOSPITAL',
      notes: input.notes,
      reason: 'Accepted by hospital staff',
    });

    await existing.save();

    await createAndDispatchCareNotification({
      recipientType: 'USER',
      recipientId: existing.userId,
      careRequestId: existing._id,
      type: 'CARE_REQUEST_ACCEPTED',
      title: 'Care Request Accepted',
      message: `Your care request (${existing.referenceId}) was accepted. ${input.notes || ''}`.trim(),
    });
  } else {
    existing.status = 'REJECTED';
    existing.rejectionReason = input.rejectionReason;
    existing.statusHistory.push({
      status: 'REJECTED',
      timestamp: now,
      updatedBy: hospitalObjectId,
      role: 'HOSPITAL',
      reason: input.rejectionReason,
    });

    await existing.save();

    await createAndDispatchCareNotification({
      recipientType: 'USER',
      recipientId: existing.userId,
      careRequestId: existing._id,
      type: 'CARE_REQUEST_REJECTED',
      title: 'Care Request Declined',
      message: `Your care request (${existing.referenceId}) was declined: ${input.rejectionReason}`,
    });
  }

  return existing;
};
