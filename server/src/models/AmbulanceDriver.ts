import { Schema, model, Types } from 'mongoose';
import { ACCOUNT_STATUSES, VERIFICATION_STATUSES, type AccountStatus, type VerificationStatus } from '../types/roles.js';
import type { AuthProvider } from './User.js';
export const DRIVER_AVAILABILITY_STATUSES = ['ONLINE','OFFLINE','BUSY'] as const;
export type DriverAvailabilityStatus = (typeof DRIVER_AVAILABILITY_STATUSES)[number];
export type DriverProfileCompletionStatus = 'INCOMPLETE'|'COMPLETE';
export interface AmbulanceDriverDocument {
  fullName: string; email: string; phone: string; passwordHash: string; authProvider: AuthProvider; providerSubject?: string; licenseNumber: string;
  licenseVerificationStatus: VerificationStatus; profileCompletionStatus: DriverProfileCompletionStatus; address?: string; city?: string; state?: string; country?: string;
  registeredLatitude?: number; registeredLongitude?: number; providerId: Types.ObjectId; assignedAmbulanceId?: Types.ObjectId; availabilityStatus: DriverAvailabilityStatus;
  accountStatus: AccountStatus; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<AmbulanceDriverDocument>({
  fullName: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, index: true }, phone: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false }, authProvider: { type: String, enum: ['LOCAL','GOOGLE','MICROSOFT'], default: 'LOCAL', index: true }, providerSubject: { type: String },
  licenseNumber: { type: String, required: true, unique: true, index: true }, licenseVerificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING' },
  profileCompletionStatus: { type: String, enum: ['INCOMPLETE','COMPLETE'], default: 'INCOMPLETE', index: true },
  address: String, city: String, state: String, country: String, registeredLatitude: Number, registeredLongitude: Number,
  providerId: { type: Schema.Types.ObjectId, ref: 'AmbulanceProvider', required: true, index: true }, assignedAmbulanceId: { type: Schema.Types.ObjectId, ref: 'Ambulance', index: true },
  availabilityStatus: { type: String, enum: DRIVER_AVAILABILITY_STATUSES, default: 'OFFLINE' }, accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'PENDING', index: true },
}, { timestamps: true });
schema.index({ authProvider: 1, providerSubject: 1 }, { unique: true, partialFilterExpression: { providerSubject: { $type: 'string' } } });
schema.index({ registeredLatitude: 1, registeredLongitude: 1 });
export const AmbulanceDriverModel = model<AmbulanceDriverDocument>('AmbulanceDriver', schema);
