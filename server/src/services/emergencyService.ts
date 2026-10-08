import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { HospitalModel } from '../models/Hospital.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { EmergencyStatusHistoryModel } from '../models/EmergencyStatusHistory.js';
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

type EmergencyQuery = { page:number; limit:number; status?:string; from?:Date; to?:Date; search?:string };

const recordHistory = async (requestId:Types.ObjectId, previousStatus:string|undefined, status:string, actorId:string|undefined, actorRole:'USER'|'HOSPITAL'|'AMBULANCE_PROVIDER'|'AMBULANCE_DRIVER'|'ADMIN'|'SYSTEM') => {
  await EmergencyStatusHistoryModel.create({
    emergencyRequestId:requestId,
    actorId:actorId ? assertId(actorId,'actor') : undefined,
    actorRole,
    previousStatus,
    status,
    changedAt:new Date(),
  });
};

export const listUserEmergencyRequests = async (userId:string, q:EmergencyQuery) => {
  const uid=assertId(userId,'user');
  const filter:Record<string,unknown>={userId:uid};
  if(q.status) filter.status=q.status;
  if(q.from||q.to) filter.reportedAt={...(q.from?{$gte:q.from}:{}),...(q.to?{$lte:q.to}:{})};
  if(q.search) filter.$or=[{requestCode:new RegExp(q.search.replace(/[.*+?^()|[\]\\]/g,'\\$&'),'i')},{situationType:new RegExp(q.search.replace(/[.*+?^()|[\]\\]/g,'\\$&'),'i')}];
  const [items,total]=await Promise.all([
    EmergencyRequestModel.find(filter).sort({reportedAt:-1}).skip((q.page-1)*q.limit).limit(q.limit).lean().exec(),
    EmergencyRequestModel.countDocuments(filter).exec(),
  ]);
  return {items:items.map(output),pagination:{page:q.page,limit:q.limit,total,totalPages:total?Math.ceil(total/q.limit):0}};
};

export const cancelUserEmergencyRequest = async (userId:string, emergencyId:string) => {
  const uid=assertId(userId,'user');
  const rid=assertId(emergencyId,'emergency');
  const cancellable=['RECEIVED','REVIEWING','PREPARING'] as const;
  const request=await EmergencyRequestModel.findOneAndUpdate(
    {_id:rid,userId:uid,status:{$in:[...cancellable]}},
    {$set:{status:'CANCELLED'}},
    {new:true}
  ).lean().exec();
  if(!request) {
    const existing=await EmergencyRequestModel.findOne({_id:rid,userId:uid}).select('status').lean().exec();
    if(!existing) throw new AppError('NOT_FOUND','Emergency request not found',404);
    throw new AppError('CANCELLATION_NOT_ALLOWED',`Emergency cannot be cancelled from status ${existing.status}`,409);
  }
  await recordHistory(rid, undefined, 'CANCELLED', userId, 'USER');
  return output(request);
};
