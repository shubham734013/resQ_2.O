import { Schema, model } from 'mongoose';
import { ACCOUNT_STATUSES, VERIFICATION_STATUSES, type AccountStatus, type VerificationStatus } from '../types/roles.js';
import type { AuthProvider } from './User.js';
export interface AmbulanceProviderDocument {
  name: string; registrationNumber: string; email: string; phone: string; passwordHash?: string; authProvider: AuthProvider; providerSubject?: string;
  profileCompletionStatus: 'INCOMPLETE'|'COMPLETE'; address?: string; city?: string; state?: string; country?: string; latitude?: number; longitude?: number;
  serviceType: string; verificationStatus: VerificationStatus; accountStatus: AccountStatus; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<AmbulanceProviderDocument>({
  name: { type: String, required: true, trim: true }, registrationNumber: { type: String, required: true, unique: true, index: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true }, phone: { type: String, required: true, default: '' },
  passwordHash: { type: String, select: false }, authProvider: { type: String, enum: ['LOCAL','GOOGLE','MICROSOFT'], default: 'LOCAL', index: true },
  providerSubject: { type: String }, profileCompletionStatus: { type: String, enum: ['INCOMPLETE','COMPLETE'], default: 'COMPLETE', index: true },
  address: String, city: String, state: String, country: String, latitude: Number, longitude: Number, serviceType: { type: String, required: true, default: '' },
  verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING' }, accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'PENDING', index: true },
}, { timestamps: true });
schema.index({ authProvider: 1, providerSubject: 1 }, { unique: true, partialFilterExpression: { providerSubject: { $type: 'string' } } });
schema.index({ latitude: 1, longitude: 1 });
export const AmbulanceProviderModel = model<AmbulanceProviderDocument>('AmbulanceProvider', schema, 'Providers_Data');
