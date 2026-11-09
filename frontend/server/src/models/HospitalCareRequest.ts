import { Schema, model, Types } from 'mongoose';

export const CARE_REQUEST_TYPES = [
  'GENERAL_CONSULTATION',
  'SPECIALIST_CONSULTATION',
  'DIAGNOSTIC',
  'FOLLOW_UP',
  'ROUTINE_CHECKUP',
  'OTHER',
] as const;
export type CareRequestType = (typeof CARE_REQUEST_TYPES)[number];

export const CARE_REQUEST_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
] as const;
export type CareRequestStatus = (typeof CARE_REQUEST_STATUSES)[number];

export const PREFERRED_TIMINGS = ['MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE'] as const;
export type PreferredTiming = (typeof PREFERRED_TIMINGS)[number];

export const CONTACT_PREFERENCES = ['PHONE', 'EMAIL', 'SMS', 'IN_APP'] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];

export interface StatusHistoryEntry {
  status: CareRequestStatus;
  timestamp: Date;
  updatedBy: Types.ObjectId;
  role: 'USER' | 'HOSPITAL' | 'ADMIN';
  reason?: string;
  notes?: string;
}

export interface HospitalCareRequestDocument {
  _id: Types.ObjectId;
  referenceId: string;
  userId: Types.ObjectId;
  hospitalId: Types.ObjectId;
  serviceDepartment: string;
  requestType: CareRequestType;
  visitReason: string;
  preferredTiming: PreferredTiming;
  contactPreference: ContactPreference;
  status: CareRequestStatus;
  hospitalResponse?: {
    notes?: string;
    respondedAt?: Date;
    respondedBy?: Types.ObjectId;
  };
  rejectionReason?: string;
  cancellationReason?: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const statusHistorySchema = new Schema<StatusHistoryEntry>(
  {
    status: { type: String, enum: CARE_REQUEST_STATUSES, required: true },
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ['USER', 'HOSPITAL', 'ADMIN'], required: true },
    reason: String,
    notes: String,
  },
  { _id: false }
);

const hospitalCareRequestSchema = new Schema<HospitalCareRequestDocument>(
  {
    referenceId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    serviceDepartment: { type: String, required: true, trim: true },
    requestType: { type: String, enum: CARE_REQUEST_TYPES, required: true },
    visitReason: { type: String, required: true, trim: true, maxlength: 1000 },
    preferredTiming: { type: String, enum: PREFERRED_TIMINGS, default: 'FLEXIBLE' },
    contactPreference: { type: String, enum: CONTACT_PREFERENCES, default: 'IN_APP' },
    status: { type: String, enum: CARE_REQUEST_STATUSES, default: 'PENDING', index: true },
    hospitalResponse: {
      notes: String,
      respondedAt: Date,
      respondedBy: { type: Schema.Types.ObjectId, ref: 'Hospital' },
    },
    rejectionReason: String,
    cancellationReason: String,
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

hospitalCareRequestSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
hospitalCareRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const HospitalCareRequestModel = model<HospitalCareRequestDocument>(
  'HospitalCareRequest',
  hospitalCareRequestSchema,
  'HospitalCareRequests'
);
