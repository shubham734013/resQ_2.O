import { Schema, model, Types } from 'mongoose';

export const HOSPITAL_EMERGENCY_STATUSES = ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION', 'RESOLVED', 'CANCELLED'] as const;
export type HospitalEmergencyStatus = (typeof HOSPITAL_EMERGENCY_STATUSES)[number];

export interface EmergencyRequestDocument {
  requestCode: string;
  hospitalId: Types.ObjectId;
  situationType: string;
  reportedAt: Date;
  location?: string;
  latitude?: number;
  longitude?: number;
  status: HospitalEmergencyStatus;
  ambulanceId?: Types.ObjectId;
  patientId?: Types.ObjectId;
  etaMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<EmergencyRequestDocument>({
  requestCode: { type: String, required: true, unique: true, index: true },
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  situationType: { type: String, required: true, trim: true },
  reportedAt: { type: Date, required: true, default: Date.now, index: true },
  location: String,
  latitude: Number,
  longitude: Number,
  status: { type: String, enum: HOSPITAL_EMERGENCY_STATUSES, default: 'RECEIVED', index: true },
  ambulanceId: { type: Schema.Types.ObjectId, ref: 'Ambulance', index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'HospitalPatient', index: true },
  etaMinutes: Number,
}, { timestamps: true });

schema.index({ hospitalId: 1, status: 1, reportedAt: -1 });
schema.index({ hospitalId: 1, reportedAt: -1 });

export const EmergencyRequestModel = model<EmergencyRequestDocument>('EmergencyRequest', schema);
