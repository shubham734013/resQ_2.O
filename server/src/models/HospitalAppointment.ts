import { Schema, model, Types } from 'mongoose';

export const APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'ALTERNATIVE_PROPOSED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface AppointmentStatusHistoryEntry {
  status: AppointmentStatus;
  timestamp: Date;
  updatedBy: Types.ObjectId;
  role: 'USER' | 'HOSPITAL' | 'ADMIN';
  reason?: string;
  notes?: string;
}

export interface AlternativeSlotProposal {
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  proposedAt: Date;
  proposedBy: Types.ObjectId;
}

export interface HospitalAppointmentDocument {
  _id: Types.ObjectId;
  appointmentCode: string;
  userId: Types.ObjectId;
  hospitalId: Types.ObjectId;
  slotId: Types.ObjectId;
  serviceDepartment: string;
  slotDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  slotDurationMinutes: number;
  status: AppointmentStatus;
  visitReason: string;
  notes?: string;
  alternativeSlot?: AlternativeSlotProposal;
  rejectionReason?: string;
  cancellationReason?: string;
  statusHistory: AppointmentStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const alternativeSlotSchema = new Schema<AlternativeSlotProposal>(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    notes: String,
    proposedAt: { type: Date, default: Date.now },
    proposedBy: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
  },
  { _id: false }
);

const appointmentStatusHistorySchema = new Schema<AppointmentStatusHistoryEntry>(
  {
    status: { type: String, enum: APPOINTMENT_STATUSES, required: true },
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ['USER', 'HOSPITAL', 'ADMIN'], required: true },
    reason: String,
    notes: String,
  },
  { _id: false }
);

const hospitalAppointmentSchema = new Schema<HospitalAppointmentDocument>(
  {
    appointmentCode: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    slotId: { type: Schema.Types.ObjectId, ref: 'HospitalAppointmentSlot', required: true, index: true },
    serviceDepartment: { type: String, required: true, trim: true },
    slotDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    slotDurationMinutes: { type: Number, required: true, min: 10, max: 240 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'PENDING', index: true },
    visitReason: { type: String, required: true, trim: true, maxlength: 1000 },
    notes: { type: String, trim: true, maxlength: 1000 },
    alternativeSlot: alternativeSlotSchema,
    rejectionReason: String,
    cancellationReason: String,
    statusHistory: { type: [appointmentStatusHistorySchema], default: [] },
  },
  { timestamps: true }
);

hospitalAppointmentSchema.index({ hospitalId: 1, slotDate: 1, status: 1 });
hospitalAppointmentSchema.index({ userId: 1, slotDate: 1, status: 1 });

export const HospitalAppointmentModel = model<HospitalAppointmentDocument>(
  'HospitalAppointment',
  hospitalAppointmentSchema,
  'HospitalAppointments'
);
