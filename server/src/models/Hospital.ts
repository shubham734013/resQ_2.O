import { Schema, model } from 'mongoose';
import { ACCOUNT_STATUSES, VERIFICATION_STATUSES, type AccountStatus, type VerificationStatus } from '../types/roles.js';

export const HOSPITAL_EMERGENCY_AVAILABILITY = ['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN'] as const;
export type HospitalEmergencyAvailability = (typeof HOSPITAL_EMERGENCY_AVAILABILITY)[number];

export interface HospitalLocation { type: 'Point'; coordinates: [number, number]; }

export interface HospitalDocument {
  name: string;
  registrationNumber: string;
  email: string;
  phone: string;
  passwordHash: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  location?: HospitalLocation;
  hospitalType: string;
  services: string[];
  capabilities: string[];
  resourceSummary: Record<string, number>;
  emergencyAvailability: HospitalEmergencyAvailability;
  publicContactInformation?: string;
  operationalDescription?: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalSchema = new Schema<HospitalDocument>({
  name: { type: String, required: true, trim: true },
  registrationNumber: { type: String, required: true, unique: true, index: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  address: String,
  city: String,
  state: String,
  country: String,
  latitude: Number,
  longitude: Number,
  location: {
    type: { type: String, enum: ['Point'], required: false },
    coordinates: { type: [Number], required: false },
  },
  hospitalType: { type: String, required: true },
  services: { type: [String], default: [] },
  capabilities: { type: [String], default: [] },
  resourceSummary: { type: Map, of: Number, default: {} },
  emergencyAvailability: { type: String, enum: HOSPITAL_EMERGENCY_AVAILABILITY, default: 'AVAILABLE', index: true },
  publicContactInformation: { type: String, trim: true },
  operationalDescription: { type: String, trim: true },
  verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING', index: true },
  accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'PENDING', index: true },
}, { timestamps: true });

hospitalSchema.pre('save', function () {
  if (typeof this.latitude === 'number' && typeof this.longitude === 'number' && (!this.location || !this.location.coordinates || this.location.coordinates.length !== 2)) {
    this.location = { type: 'Point', coordinates: [this.longitude, this.latitude] };
  } else if (this.location?.coordinates && this.location.coordinates.length === 2 && (this.latitude === undefined || this.longitude === undefined)) {
    this.longitude = this.location.coordinates[0];
    this.latitude = this.location.coordinates[1];
  }
});

hospitalSchema.index({ location: '2dsphere' });
hospitalSchema.index({ latitude: 1, longitude: 1 });

export const HospitalModel = model<HospitalDocument>('Hospital', hospitalSchema, 'Hospitals_data');
