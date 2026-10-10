import { Schema, model, Types } from 'mongoose';
import { ROLES, type Role } from '../types/roles.js';

export const HOSPITAL_EMERGENCY_STATUSES = ['RECEIVED','REVIEWING','PREPARING','AMBULANCE_COORDINATION','RESOLVED','CANCELLED'] as const;
export type HospitalEmergencyStatus = (typeof HOSPITAL_EMERGENCY_STATUSES)[number];

export type EmergencyStatusActorRole = Role | 'SYSTEM';

export interface EmergencyStatusHistoryEntry {
  status: HospitalEmergencyStatus;
  changedAt: Date;
  actorId?: Types.ObjectId;
  actorRole: EmergencyStatusActorRole;
  previousStatus?: HospitalEmergencyStatus;
}

export interface EmergencyRequestDocument {
  requestCode: string;
  idempotencyKey?: string;
  userId: Types.ObjectId;
  hospitalId: Types.ObjectId;
  situationType: string;
  reportedAt: Date;
  location?: string;
  latitude?: number;
  longitude?: number;
  status: HospitalEmergencyStatus;
  statusHistory: EmergencyStatusHistoryEntry[];
  ambulanceId?: Types.ObjectId;
  ambulanceProviderId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  patientId?: Types.ObjectId;
  etaMinutes?: number;
  routeDistanceMeters?: number;
  createdAt: Date;
  updatedAt: Date;
}

const statusHistorySchema = new Schema<EmergencyStatusHistoryEntry>({
  status: { type: String, enum: HOSPITAL_EMERGENCY_STATUSES, required: true },
  changedAt: { type: Date, required: true },
  actorId: { type: Schema.Types.ObjectId, required: false },
  actorRole: { type: String, enum: [...ROLES, 'SYSTEM'], required: true, default: 'SYSTEM' },
  previousStatus: { type: String, enum: HOSPITAL_EMERGENCY_STATUSES, required: false },
}, { _id: false });

const schema = new Schema<EmergencyRequestDocument>({
  requestCode: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, required: false, trim: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  situationType: { type: String, required: true, trim: true },
  reportedAt: { type: Date, required: true, default: Date.now, index: true },
  location: String,
  latitude: Number,
  longitude: Number,
  status: { type: String, enum: HOSPITAL_EMERGENCY_STATUSES, default: 'RECEIVED', index: true },
  statusHistory: { type: [statusHistorySchema], default: [] },
  ambulanceId: { type: Schema.Types.ObjectId, ref: 'Ambulance', index: true },
  ambulanceProviderId: { type: Schema.Types.ObjectId, ref: 'AmbulanceProvider', index: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'AmbulanceDriver', index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'HospitalPatient', index: true },
  etaMinutes: Number,
  routeDistanceMeters: Number,
}, { timestamps: true });

schema.index({ idempotencyKey: 1 }, { unique: true, sparse: true, name: 'emergency_idempotency_key_unique' });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ hospitalId: 1, status: 1, reportedAt: -1 });
schema.index({ hospitalId: 1, reportedAt: -1 });
schema.index({ status: 1, ambulanceProviderId: 1, reportedAt: -1 });
schema.index({ ambulanceId: 1, driverId: 1, status: 1 });
schema.index({ statusHistory: 1, reportedAt: -1 });

export const EmergencyRequestModel = model<EmergencyRequestDocument>('EmergencyRequest', schema);