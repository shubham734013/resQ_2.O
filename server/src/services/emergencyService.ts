import { Types } from 'mongoose';
import { HospitalModel } from '../models/Hospital.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { TripModel } from '../models/Trip.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AppError } from '../utils/AppError.js';
import type { z } from 'zod';
import type { createEmergencyRequestSchema } from '../schemas/emergency.js';
import type { HospitalEmergencyStatus } from '../models/EmergencyRequest.js';

type CreateEmergencyInput = z.infer<typeof createEmergencyRequestSchema>;
type RequestDocument = Awaited<ReturnType<typeof EmergencyRequestModel.findOne>>;

export const USER_CANCELLABLE_STATUSES: HospitalEmergencyStatus[] = ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'];
export const EMERGENCY_ACTIVE_TRIP_STATUSES = ['ASSIGNED', 'ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'] as const;
export const EMERGENCY_MATERIAL_TRANSPORT_STATUSES = ['TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'] as const;

const assertId = (value: string, name: string) => {
  if (!Types.ObjectId.isValid(value)) throw new AppError('INVALID_ID', `Invalid ${name}`, 400);
  return new Types.ObjectId(value);
};

const output = (request: NonNullable<RequestDocument>) => ({
  id: String(request._id),
  requestCode: request.requestCode,
  hospitalId: String(request.hospitalId),
  situationType: request.situationType,
  reportedAt: request.reportedAt,
  location: request.location,
  latitude: request.latitude,
  longitude: request.longitude,
  status: request.status,
  statusHistory: request.statusHistory.map((entry) => ({
    status: entry.status,
    changedAt: entry.changedAt,
    actorId: entry.actorId ? String(entry.actorId) : undefined,
    actorRole: entry.actorRole,
    previousStatus: entry.previousStatus,
  })),
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
  }).select('_id').lean().exec();

  if (!hospital) {
    throw new AppError('HOSPITAL_NOT_OPERATIONAL', 'The selected hospital is not currently accepting emergency requests through ResQ', 409);
  }

  const now = new Date();
  const request = await EmergencyRequestModel.create({
    requestCode: 'RSQ-' + cryptoSafeCode(),
    userId: userObjectId,
    hospitalId,
    situationType: input.situationType,
    reportedAt: now,
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
    status: 'RECEIVED',
    statusHistory: [{ status: 'RECEIVED', changedAt: now, actorId: userObjectId, actorRole: 'USER' }],
  });

  const patient = await HospitalPatientModel.findOneAndUpdate(
    { emergencyId: request._id },
    {
      $setOnInsert: {
        caseId: 'CASE-' + cryptoSafeCode(),
        hospitalId,
        emergencyId: request._id,
        emergencyType: input.situationType,
        coordinationStatus: 'INCOMING',
        receivedAt: now,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  const linked = await EmergencyRequestModel.findOneAndUpdate(
    { _id: request._id, status: 'RECEIVED', patientId: { $exists: false } },
    { $set: { patientId: patient._id } },
    { new: true },
  ).lean().exec();

  if (!linked) throw new AppError('EMERGENCY_LINK_FAILED', 'Emergency request could not be linked to the hospital case', 500);
  return output(linked);
};

const cryptoSafeCode = () => Math.random().toString(36).slice(2, 14).toUpperCase();

export const listUserEmergencyRequests = async (
  userId: string,
  query: { page: number; limit: number; status?: HospitalEmergencyStatus; from?: Date; to?: Date; search?: string; sortOrder: 'asc' | 'desc' },
) => {
  const userObjectId = assertId(userId, 'user');
  const filter: Record<string, unknown> = { userId: userObjectId };
  if (query.status) filter.status = query.status;
  if (query.from || query.to) filter.reportedAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  if (query.search) filter.$or = [
    { requestCode: new RegExp(escapeRegex(query.search), 'i') },
    { situationType: new RegExp(escapeRegex(query.search), 'i') },
  ];

  const [items, total] = await Promise.all([
    EmergencyRequestModel.find(filter)
      .sort({ reportedAt: query.sortOrder === 'asc' ? 1 : -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    EmergencyRequestModel.countDocuments(filter).exec(),
  ]);

  return {
    items: items.map(output),
    pagination: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) },
  };
};

export const getUserEmergencyRequest = async (userId: string, emergencyId: string) => {
  const userObjectId = assertId(userId, 'user');
  const requestId = assertId(emergencyId, 'emergency');
  const request = await EmergencyRequestModel.findOne({ _id: requestId, userId: userObjectId }).lean().exec();
  if (!request) throw new AppError('NOT_FOUND', 'Emergency request not found', 404);
  return output(request);
};

export const cancelUserEmergencyRequest = async (userId: string, emergencyId: string) => {
  const userObjectId = assertId(userId, 'user');
  const requestId = assertId(emergencyId, 'emergency');

  const current = await EmergencyRequestModel.findOne({ _id: requestId, userId: userObjectId }).lean().exec();
  if (!current) throw new AppError('NOT_FOUND', 'Emergency request not found', 404);
  if (!USER_CANCELLABLE_STATUSES.includes(current.status)) {
    throw new AppError('EMERGENCY_NOT_CANCELLABLE', 'This emergency is no longer eligible for user cancellation', 409);
  }

  const trip = await TripModel.findOne({ emergencyRequestId: requestId, status: { $in: EMERGENCY_ACTIVE_TRIP_STATUSES } }).lean().exec();
  if (trip && (EMERGENCY_MATERIAL_TRANSPORT_STATUSES as readonly string[]).includes(trip.status)) {
    throw new AppError('TRANSPORT_ALREADY_STARTED', 'Cancellation is not allowed after patient transport has started', 409);
  }

  const now = new Date();
  const updated = await EmergencyRequestModel.findOneAndUpdate(
    { _id: requestId, userId: userObjectId, status: current.status },
    {
      $set: { status: 'CANCELLED' },
      $push: {
        statusHistory: {
          status: 'CANCELLED',
          changedAt: now,
          actorId: userObjectId,
          actorRole: 'USER',
          previousStatus: current.status,
        },
      },
    },
    { new: true, runValidators: true },
  ).lean().exec();

  if (!updated) throw new AppError('STALE_EMERGENCY_UPDATE', 'Emergency request changed before cancellation could be applied', 409);

  if (trip) {
    await TripModel.updateOne(
      { _id: trip._id, status: { $in: EMERGENCY_ACTIVE_TRIP_STATUSES } },
      { $set: { status: 'CANCELLED' } },
    ).exec();
    await Promise.all([
      AmbulanceModel.updateOne({ _id: trip.ambulanceId, currentStatus: 'BUSY' }, { $set: { currentStatus: 'AVAILABLE' } }).exec(),
      AmbulanceDriverModel.updateOne({ _id: trip.driverId, availabilityStatus: 'BUSY' }, { $set: { availabilityStatus: 'ONLINE' } }).exec(),
    ]);
  } else if (current.ambulanceId) {
    await AmbulanceModel.updateOne({ _id: current.ambulanceId, currentStatus: 'BUSY' }, { $set: { currentStatus: 'AVAILABLE' } }).exec();
    if (current.driverId) {
      await AmbulanceDriverModel.updateOne({ _id: current.driverId, availabilityStatus: 'BUSY' }, { $set: { availabilityStatus: 'ONLINE' } }).exec();
    }
  }

  await HospitalPatientModel.updateOne(
    { emergencyId: requestId, coordinationStatus: { $nin: ['RESOLVED', 'CANCELLED'] } },
    { $set: { coordinationStatus: 'CANCELLED' }, $unset: { ambulanceId: 1, etaMinutes: 1 } },
  ).exec();

  return output(updated);
};

const escapeRegex = (value: string) => value.replace(/[.*+?^()|[\]\\]/g, '\\$&');
