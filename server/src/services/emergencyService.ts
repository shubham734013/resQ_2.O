import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { HospitalModel } from '../models/Hospital.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import type { EmergencyRequestDocument } from '../models/EmergencyRequest.js';
import { AppError } from '../utils/AppError.js';
import type { z } from 'zod';
import type { createEmergencyRequestSchema } from '../schemas/emergency.js';

type CreateEmergencyInput = z.infer<typeof createEmergencyRequestSchema>;

type EmergencyRequestOutputSource = EmergencyRequestDocument & {
  _id: Types.ObjectId;
};

const assertId = (value: string, name: string) => {
  if (!Types.ObjectId.isValid(value)) throw new AppError('INVALID_ID', `Invalid ${name}`, 400);
  return new Types.ObjectId(value);
};

const output = (request: EmergencyRequestOutputSource) => ({
  id: String(request._id),
  requestCode: request.requestCode,
  hospitalId: String(request.hospitalId),
  situationType: request.situationType,
  reportedAt: request.reportedAt,
  location: request.location,
  latitude: request.latitude,
  longitude: request.longitude,
  status: request.status,
  ambulanceId: request.ambulanceId ? String(request.ambulanceId) : undefined,
  ambulanceProviderId: request.ambulanceProviderId ? String(request.ambulanceProviderId) : undefined,
  driverId: request.driverId ? String(request.driverId) : undefined,
  patientId: request.patientId ? String(request.patientId) : undefined,
  etaMinutes: request.etaMinutes,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

export const createEmergencyRequest = async (userId: string, input: CreateEmergencyInput) => {
  const userObjectId = assertId(userId, 'user');
  const hospitalId = assertId(input.hospitalId, 'hospital');

  const hospital = await HospitalModel.findOne({
    _id: hospitalId,
    accountStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    emergencyAvailability: { $ne: 'UNAVAILABLE' },
  })
    .select('_id')
    .lean()
    .exec();

  if (!hospital) {
    throw new AppError(
      'HOSPITAL_NOT_OPERATIONAL',
      'The selected hospital is not currently accepting emergency requests through ResQ',
      409,
    );
  }

  const request = await EmergencyRequestModel.create({
    requestCode: 'RSQ-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
    userId: userObjectId,
    hospitalId,
    situationType: input.situationType,
    reportedAt: new Date(),
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
    status: 'RECEIVED',
  });

  return output({
    ...request.toObject(),
    _id: request._id,
  });
};

export const getUserEmergencyRequest = async (userId: string, emergencyId: string) => {
  const userObjectId = assertId(userId, 'user');
  const requestId = assertId(emergencyId, 'emergency');

  const request = await EmergencyRequestModel.findOne({
    _id: requestId,
    userId: userObjectId,
  })
    .lean()
    .exec();

  if (!request) throw new AppError('NOT_FOUND', 'Emergency request not found', 404);
  return output(request);
};
