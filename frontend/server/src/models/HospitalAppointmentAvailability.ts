import { Schema, model, Types } from 'mongoose';

export interface DaySchedule {
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  isEnabled: boolean;
  startTime: string; // HH:mm (e.g. '09:00')
  endTime: string; // HH:mm (e.g. '17:00')
  breakStartTime?: string; // HH:mm (e.g. '13:00')
  breakEndTime?: string; // HH:mm (e.g. '14:00')
}

export interface HospitalAppointmentAvailabilityDocument {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId;
  department: string;
  slotDurationMinutes: number;
  maxCapacityPerSlot: number;
  weeklySchedule: DaySchedule[];
  blackoutDates: string[]; // YYYY-MM-DD format
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const dayScheduleSchema = new Schema<DaySchedule>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isEnabled: { type: Boolean, default: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    breakStartTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    breakEndTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

const hospitalAppointmentAvailabilitySchema = new Schema<HospitalAppointmentAvailabilityDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    department: { type: String, required: true, trim: true },
    slotDurationMinutes: { type: Number, required: true, min: 10, max: 240, default: 30 },
    maxCapacityPerSlot: { type: Number, required: true, min: 1, max: 20, default: 1 },
    weeklySchedule: { type: [dayScheduleSchema], default: [] },
    blackoutDates: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

hospitalAppointmentAvailabilitySchema.index({ hospitalId: 1, department: 1 }, { unique: true });

export const HospitalAppointmentAvailabilityModel = model<HospitalAppointmentAvailabilityDocument>(
  'HospitalAppointmentAvailability',
  hospitalAppointmentAvailabilitySchema,
  'HospitalAppointmentAvailabilities'
);
