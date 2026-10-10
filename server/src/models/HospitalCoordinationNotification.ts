import { Schema, model, Types } from 'mongoose';

export const HOSPITAL_COORDINATION_NOTIFICATION_TYPES = [
  'EMERGENCY_RECEIVED', 'EMERGENCY_CANCELLED', 'AMBULANCE_ASSIGNED', 'AMBULANCE_REASSIGNED',
  'AMBULANCE_AT_PICKUP', 'PATIENT_PICKED_UP', 'EN_ROUTE_TO_HOSPITAL', 'AMBULANCE_ARRIVED',
  'TRIP_COMPLETED', 'TRIP_CANCELLED',
] as const;
export type HospitalCoordinationNotificationType = (typeof HOSPITAL_COORDINATION_NOTIFICATION_TYPES)[number];
export const HOSPITAL_COORDINATION_NOTIFICATION_STATES = ['UNREAD', 'ACKNOWLEDGED', 'SUPERSEDED'] as const;
export type HospitalCoordinationNotificationState = (typeof HOSPITAL_COORDINATION_NOTIFICATION_STATES)[number];

export interface HospitalCoordinationNotificationDocument {
  hospitalId: Types.ObjectId;
  emergencyId: Types.ObjectId;
  tripId?: Types.ObjectId;
  ambulanceId?: Types.ObjectId;
  ambulanceRegistration?: string;
  ambulanceVehicleNumber?: string;
  dedupeKey: string;
  type: HospitalCoordinationNotificationType;
  state: HospitalCoordinationNotificationState;
  requestCode: string;
  emergencyCategory: string;
  tripStatus?: string;
  title: string;
  message: string;
  etaMinutes?: number;
  acknowledgedAt?: Date;
  acknowledgedBy?: Types.ObjectId;
  deliveryAttemptCount: number;
  lastDeliveryAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<HospitalCoordinationNotificationDocument>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  emergencyId: { type: Schema.Types.ObjectId, ref: 'EmergencyRequest', required: true, index: true },
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', index: true },
  ambulanceId: { type: Schema.Types.ObjectId, ref: 'Ambulance' },
  ambulanceRegistration: { type: String, maxlength: 80 },
  ambulanceVehicleNumber: { type: String, maxlength: 80 },
  dedupeKey: { type: String, required: true, unique: true },
  type: { type: String, enum: HOSPITAL_COORDINATION_NOTIFICATION_TYPES, required: true, index: true },
  state: { type: String, enum: HOSPITAL_COORDINATION_NOTIFICATION_STATES, required: true, default: 'UNREAD', index: true },
  requestCode: { type: String, required: true },
  emergencyCategory: { type: String, required: true },
  tripStatus: String,
  title: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 500 },
  etaMinutes: { type: Number, min: 0 },
  acknowledgedAt: Date,
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  deliveryAttemptCount: { type: Number, min: 0, default: 0 },
  lastDeliveryAttemptAt: Date,
}, { timestamps: true });

schema.index({ hospitalId: 1, state: 1, createdAt: -1 });
schema.index({ hospitalId: 1, emergencyId: 1, createdAt: -1 });

export const HospitalCoordinationNotificationModel = model<HospitalCoordinationNotificationDocument>('HospitalCoordinationNotification', schema);
