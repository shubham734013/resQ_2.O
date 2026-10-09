import { Schema, model, Types } from 'mongoose';

export const HOSPITAL_PATIENT_STATUSES = ['INCOMING', 'HOSPITAL_NOTIFIED', 'AT_HOSPITAL', 'RESOLVED', 'CANCELLED'] as const;
export type HospitalPatientStatus = (typeof HOSPITAL_PATIENT_STATUSES)[number];

export interface HospitalPatientDocument {
  caseId: string;
  hospitalId: Types.ObjectId;
  emergencyId: Types.ObjectId;
  ambulanceId?: Types.ObjectId;
  coordinationStatus: HospitalPatientStatus;
  emergencyType: string;
  etaMinutes?: number;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<HospitalPatientDocument>({
  caseId: { type: String, required: true, unique: true, index: true },
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  emergencyId: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest', required: true, unique: true, index: true },
  ambulanceId: { type: Schema.Types.ObjectId, ref: 'Ambulance', index: true },
  coordinationStatus: { type: String, enum: HOSPITAL_PATIENT_STATUSES, default: 'INCOMING', index: true },
  emergencyType: { type: String, required: true, trim: true },
  etaMinutes: Number,
  receivedAt: { type: Date, required: true, default: Date.now, index: true },
}, { timestamps: true });

schema.index({ hospitalId: 1, coordinationStatus: 1, receivedAt: -1 });

export const HospitalPatientModel = model<HospitalPatientDocument>('HospitalPatient', schema);
