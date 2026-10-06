import { Schema, model } from 'mongoose';
import { ACCOUNT_STATUSES, VERIFICATION_STATUSES, type AccountStatus, type VerificationStatus } from '../types/roles.js';

export const HOSPITAL_EMERGENCY_AVAILABILITY = ['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN'] as const;
export type HospitalEmergencyAvailability = (typeof HOSPITAL_EMERGENCY_AVAILABILITY)[number];
export interface HospitalDocument { name: string; registrationNumber: string; email: string; phone: string; passwordHash: string; address?: string; city?: string; state?: string; country?: string; latitude?: number; longitude?: number; hospitalType: string; services: string[]; capabilities: string[]; resourceSummary: Record<string, number>; emergencyAvailability: HospitalEmergencyAvailability; publicContactInformation?: string; operationalDescription?: string; verificationStatus: VerificationStatus; accountStatus: AccountStatus; createdAt: Date; updatedAt: Date; }
const hospitalSchema = new Schema<HospitalDocument>({
  name: { type: String, required: true, trim: true }, registrationNumber: { type: String, required: true, unique: true, index: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true }, phone: { type: String, required: true, trim: true }, passwordHash: { type: String, required: true, select: false },
  address: String, city: String, state: String, country: String, latitude: Number, longitude: Number,
  hospitalType: { type: String, required: true }, services: { type: [String], default: [] }, capabilities: { type: [String], default: [] }, resourceSummary: { type: Map, of: Number, default: {} }, emergencyAvailability: { type: String, enum: HOSPITAL_EMERGENCY_AVAILABILITY, default: 'AVAILABLE', index: true },
  publicContactInformation: { type: String, trim: true }, operationalDescription: { type: String, trim: true },
  verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING', index: true }, accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'PENDING', index: true },
}, { timestamps: true });
hospitalSchema.index({ latitude: 1, longitude: 1 });
export const HospitalModel = model<HospitalDocument>('Hospital', hospitalSchema);
