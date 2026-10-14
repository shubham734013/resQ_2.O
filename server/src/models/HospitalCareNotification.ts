import { Schema, model, Types } from 'mongoose';

export const HOSPITAL_CARE_NOTIFICATION_TYPES = [
  'CARE_REQUEST_CREATED',
  'CARE_REQUEST_ACCEPTED',
  'CARE_REQUEST_REJECTED',
  'CARE_REQUEST_CANCELLED',
  'APPOINTMENT_BOOKED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_REJECTED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_ALTERNATIVE_PROPOSED',
  'APPOINTMENT_COMPLETED',
] as const;
export type HospitalCareNotificationType = (typeof HOSPITAL_CARE_NOTIFICATION_TYPES)[number];

export const HOSPITAL_CARE_NOTIFICATION_STATUSES = ['UNREAD', 'READ'] as const;
export type HospitalCareNotificationStatus = (typeof HOSPITAL_CARE_NOTIFICATION_STATUSES)[number];

export interface HospitalCareNotificationDocument {
  _id: Types.ObjectId;
  recipientType: 'USER' | 'HOSPITAL';
  recipientId: Types.ObjectId;
  careRequestId?: Types.ObjectId;
  appointmentId?: Types.ObjectId;
  type: HospitalCareNotificationType;
  title: string;
  message: string;
  status: HospitalCareNotificationStatus;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalCareNotificationSchema = new Schema<HospitalCareNotificationDocument>(
  {
    recipientType: { type: String, enum: ['USER', 'HOSPITAL'], required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, required: true, index: true },
    careRequestId: { type: Schema.Types.ObjectId, ref: 'HospitalCareRequest', index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'HospitalAppointment', index: true },
    type: { type: String, enum: HOSPITAL_CARE_NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: HOSPITAL_CARE_NOTIFICATION_STATUSES, default: 'UNREAD', index: true },
    readAt: Date,
  },
  { timestamps: true }
);

hospitalCareNotificationSchema.index({ recipientType: 1, recipientId: 1, status: 1, createdAt: -1 });

export const HospitalCareNotificationModel = model<HospitalCareNotificationDocument>(
  'HospitalCareNotification',
  hospitalCareNotificationSchema,
  'HospitalCareNotifications'
);
