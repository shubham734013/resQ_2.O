import { Schema, model, Types } from 'mongoose';
import { ACCOUNT_STATUSES, VERIFICATION_STATUSES, type AccountStatus, type VerificationStatus } from '../types/roles.js';
export const DRIVER_AVAILABILITY_STATUSES = ['ONLINE', 'OFFLINE', 'BUSY'] as const;
export type DriverAvailabilityStatus = (typeof DRIVER_AVAILABILITY_STATUSES)[number];
export interface AmbulanceDriverDocument { fullName: string; email: string; phone: string; passwordHash: string; licenseNumber: string; licenseVerificationStatus: VerificationStatus; address?: string; city?: string; state?: string; country?: string; registeredLatitude?: number; registeredLongitude?: number; providerId: Types.ObjectId; assignedAmbulanceId?: Types.ObjectId; availabilityStatus: DriverAvailabilityStatus; accountStatus: AccountStatus; createdAt: Date; updatedAt: Date; }
const schema = new Schema<AmbulanceDriverDocument>({
  fullName: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, index: true }, phone: { type: String, required: true }, passwordHash: { type: String, required: true, select: false }, licenseNumber: { type: String, required: true, unique: true, index: true }, licenseVerificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING' }, address: String, city: String, state: String, country: String, registeredLatitude: Number, registeredLongitude: Number, providerId: { type: Schema.Types.ObjectId, ref: 'AmbulanceProvider', required: true, index: true }, assignedAmbulanceId: { type: Schema.Types.ObjectId, ref: 'Ambulance', index: true }, availabilityStatus: { type: String, enum: DRIVER_AVAILABILITY_STATUSES, default: 'OFFLINE' }, accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'PENDING', index: true },
}, { timestamps: true });
schema.index({ registeredLatitude: 1, registeredLongitude: 1 });
export const AmbulanceDriverModel = model<AmbulanceDriverDocument>('AmbulanceDriver', schema);
