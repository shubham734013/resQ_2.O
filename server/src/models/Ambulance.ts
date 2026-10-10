import { Schema, model, Types } from 'mongoose';
import { ACCOUNT_STATUSES, VERIFICATION_STATUSES, type AccountStatus, type VerificationStatus } from '../types/roles.js';

export const AMBULANCE_STATUSES = ['AVAILABLE', 'BUSY', 'OFFLINE', 'MAINTENANCE'] as const;
export type AmbulanceStatus = (typeof AMBULANCE_STATUSES)[number];
export interface AmbulanceLocation { type: 'Point'; coordinates: [number, number]; }

export interface AmbulanceDocument {
  registrationNumber: string;
  vehicleNumber: string;
  providerId: Types.ObjectId;
  ambulanceType: string;
  capabilities: string[];
  currentStatus: AmbulanceStatus;
  currentLatitude?: number;
  currentLongitude?: number;
  location?: AmbulanceLocation;
  locationUpdatedAt?: Date;
  locationSourceTimestamp?: Date;
  locationAccuracyMeters?: number;
  dispatchReservationId?: Types.ObjectId;
  dispatchReservationExpiresAt?: Date;
  serviceArea?: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<AmbulanceDocument>({
  registrationNumber: { type: String, required: true, unique: true, index: true },
  vehicleNumber: { type: String, required: true, unique: true, index: true },
  providerId: { type: Schema.Types.ObjectId, ref: 'AmbulanceProvider', required: true, index: true },
  ambulanceType: { type: String, required: true },
  capabilities: { type: [String], default: [] },
  currentStatus: { type: String, enum: AMBULANCE_STATUSES, default: 'OFFLINE', index: true },
  currentLatitude: Number,
  currentLongitude: Number,
  location: {
    type: { type: String, enum: ['Point'], required: false },
    coordinates: { type: [Number], required: false },
  },
  locationUpdatedAt: Date,
  locationSourceTimestamp: Date,
  locationAccuracyMeters: Number,
  dispatchReservationId: { type: Schema.Types.ObjectId, index: true },
  dispatchReservationExpiresAt: Date,
  serviceArea: String,
  verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING', index: true },
  accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'PENDING', index: true },
}, { timestamps: true });

schema.index({ location: '2dsphere' });
schema.index({ currentLatitude: 1, currentLongitude: 1 });

export const AmbulanceModel = model<AmbulanceDocument>('Ambulance', schema, 'Ambulance_Data');
