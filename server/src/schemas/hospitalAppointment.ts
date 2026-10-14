import { z } from 'zod';
import { APPOINTMENT_STATUSES } from '../models/HospitalAppointment.js';

const objectIdRegex = /^[a-f0-9]{24}$/i;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const queryAvailabilitySchema = z.object({
  hospitalId: z.string().regex(objectIdRegex, 'Invalid hospital ID format'),
  department: z.string().trim().min(2, 'Department name is required'),
  date: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
});

export const bookAppointmentSchema = z.object({
  hospitalId: z.string().regex(objectIdRegex, 'Invalid hospital ID format'),
  department: z.string().trim().min(2, 'Department name is required'),
  date: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(timeRegex, 'Start time must be in HH:mm format'),
  visitReason: z.string().trim().min(3, 'Reason for visit must be at least 3 characters').max(1000),
  notes: z.string().trim().max(1000).optional(),
});

export const confirmAppointmentSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const rejectAppointmentSchema = z.object({
  rejectionReason: z.string().trim().min(3, 'Rejection reason must be at least 3 characters').max(1000),
});

export const proposeAlternativeSlotSchema = z.object({
  date: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(timeRegex, 'Start time must be in HH:mm format'),
  notes: z.string().trim().max(1000).optional(),
});

export const cancelAppointmentSchema = z.object({
  cancellationReason: z.string().trim().max(500).optional(),
});

export const dayScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isEnabled: z.boolean().default(true),
  startTime: z.string().regex(timeRegex, 'Start time must be HH:mm'),
  endTime: z.string().regex(timeRegex, 'End time must be HH:mm'),
  breakStartTime: z.string().regex(timeRegex, 'Break start must be HH:mm').optional(),
  breakEndTime: z.string().regex(timeRegex, 'Break end must be HH:mm').optional(),
}).refine(
  (data) => !data.isEnabled || data.startTime < data.endTime,
  { message: 'Start time must be before end time', path: ['startTime'] }
);

export const updateAvailabilitySchema = z.object({
  department: z.string().trim().min(2, 'Department name is required'),
  slotDurationMinutes: z.number().int().min(10).max(240).default(30),
  maxCapacityPerSlot: z.number().int().min(1).max(20).default(1),
  weeklySchedule: z.array(dayScheduleSchema),
  blackoutDates: z.array(z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format')).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD').optional(),
  department: z.string().trim().optional(),
});
