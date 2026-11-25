import { Schema, model, Types } from 'mongoose';

export interface HospitalAppointmentSlotDocument {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId;
  department: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  maxCapacity: number;
  bookedCount: number;
  isCancelled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalAppointmentSlotSchema = new Schema<HospitalAppointmentSlotDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    department: { type: String, required: true, trim: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    maxCapacity: { type: Number, required: true, min: 1, default: 1 },
    bookedCount: { type: Number, required: true, min: 0, default: 0 },
    isCancelled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hospitalAppointmentSlotSchema.index(
  { hospitalId: 1, department: 1, date: 1, startTime: 1 },
  { unique: true }
);

export const HospitalAppointmentSlotModel = model<HospitalAppointmentSlotDocument>(
  'HospitalAppointmentSlot',
  hospitalAppointmentSlotSchema,
  'HospitalAppointmentSlots'
);
