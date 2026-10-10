import { Schema, model, Types } from 'mongoose';

export const DISPATCH_JOB_STATUSES = ['PENDING', 'SEARCHING', 'OFFERED', 'ACCEPTED', 'EXHAUSTED', 'CANCELLED', 'ESCALATED'] as const;
export type DispatchJobStatus = (typeof DISPATCH_JOB_STATUSES)[number];
export const DISPATCH_ATTEMPT_STATUSES = ['OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'UNAVAILABLE', 'CANCELLED'] as const;
export type DispatchAttemptStatus = (typeof DISPATCH_ATTEMPT_STATUSES)[number];
export type DispatchRouteSource = 'DRIVING' | 'STRAIGHT_LINE_FALLBACK';

export interface DispatchAttemptDocument {
  attemptId: string;
  generation: number;
  attemptNumber: number;
  providerId: Types.ObjectId;
  ambulanceId: Types.ObjectId;
  driverId: Types.ObjectId;
  status: DispatchAttemptStatus;
  offeredAt: Date;
  deadlineAt: Date;
  respondedAt?: Date;
  routeSource: DispatchRouteSource;
  routeDistanceMeters: number;
  etaSeconds?: number;
  reason?: string;
}

export interface DispatchJobEvent {
  event: string;
  at: Date;
  actorId?: Types.ObjectId;
  actorRole: 'SYSTEM' | 'ADMIN' | 'AMBULANCE_DRIVER' | 'USER';
  reason?: string;
  attemptId?: string;
}

export interface DispatchJobDocument {
  emergencyRequestId: Types.ObjectId;
  hospitalId: Types.ObjectId;
  userId: Types.ObjectId;
  category: string;
  pickupLatitude: number;
  pickupLongitude: number;
  status: DispatchJobStatus;
  generation: number;
  attempts: DispatchAttemptDocument[];
  events: DispatchJobEvent[];
  currentAttemptId?: string;
  currentProviderId?: Types.ObjectId;
  currentAmbulanceId?: Types.ObjectId;
  currentDriverId?: Types.ObjectId;
  deadlineAt?: Date;
  leaseUntil?: Date;
  leaseToken?: string;
  nextAttemptAt?: Date;
  acceptedTripId?: Types.ObjectId;
  exhaustedAt?: Date;
  escalatedAt?: Date;
  escalationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const attemptSchema = new Schema<DispatchAttemptDocument>({
  attemptId: { type: String, required: true },
  generation: { type: Number, required: true },
  attemptNumber: { type: Number, required: true },
  providerId: { type: Schema.Types.ObjectId, ref: 'AmbulanceProvider', required: true },
  ambulanceId: { type: Schema.Types.ObjectId, ref: 'Ambulance', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'AmbulanceDriver', required: true },
  status: { type: String, enum: DISPATCH_ATTEMPT_STATUSES, required: true },
  offeredAt: { type: Date, required: true },
  deadlineAt: { type: Date, required: true },
  respondedAt: Date,
  routeSource: { type: String, enum: ['DRIVING', 'STRAIGHT_LINE_FALLBACK'], required: true },
  routeDistanceMeters: { type: Number, required: true, min: 0 },
  etaSeconds: { type: Number, min: 0 },
  reason: { type: String, maxlength: 300 },
}, { _id: false });

const eventSchema = new Schema<DispatchJobEvent>({
  event: { type: String, required: true, maxlength: 80 },
  at: { type: Date, required: true },
  actorId: { type: Schema.Types.ObjectId, required: false },
  actorRole: { type: String, enum: ['SYSTEM', 'ADMIN', 'AMBULANCE_DRIVER', 'USER'], required: true },
  reason: { type: String, maxlength: 500 },
  attemptId: String,
}, { _id: false });

const schema = new Schema<DispatchJobDocument>({
  emergencyRequestId: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest', required: true, unique: true, index: true },
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, required: true },
  pickupLatitude: { type: Number, required: true, min: -90, max: 90 },
  pickupLongitude: { type: Number, required: true, min: -180, max: 180 },
  status: { type: String, enum: DISPATCH_JOB_STATUSES, required: true, default: 'PENDING', index: true },
  generation: { type: Number, required: true, default: 1 },
  attempts: { type: [attemptSchema], default: [] },
  events: { type: [eventSchema], default: [] },
  currentAttemptId: String,
  currentProviderId: { type: Schema.Types.ObjectId, ref: 'AmbulanceProvider' },
  currentAmbulanceId: { type: Schema.Types.ObjectId, ref: 'Ambulance' },
  currentDriverId: { type: Schema.Types.ObjectId, ref: 'AmbulanceDriver' },
  deadlineAt: Date,
  leaseUntil: Date,
  leaseToken: String,
  nextAttemptAt: Date,
  acceptedTripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
  exhaustedAt: Date,
  escalatedAt: Date,
  escalationReason: { type: String, maxlength: 500 },
}, { timestamps: true });

schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1, updatedAt: 1 });
schema.index({ currentDriverId: 1, status: 1, deadlineAt: 1 });
schema.index({ currentAmbulanceId: 1, status: 1 });
export const DispatchJobModel = model<DispatchJobDocument>('DispatchJob', schema);
