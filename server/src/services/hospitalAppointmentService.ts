import { Types } from 'mongoose';
import {
  HospitalAppointmentModel,
  type HospitalAppointmentDocument,
  type AppointmentStatus,
} from '../models/HospitalAppointment.js';
import {
  HospitalAppointmentAvailabilityModel,
  type HospitalAppointmentAvailabilityDocument,
  type DaySchedule,
} from '../models/HospitalAppointmentAvailability.js';
import {
  HospitalAppointmentSlotModel,
  type HospitalAppointmentSlotDocument,
} from '../models/HospitalAppointmentSlot.js';
import { HospitalModel } from '../models/Hospital.js';
import { UserModel } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { createAndDispatchCareNotification } from './hospitalCareNotificationService.js';

const generateAppointmentCode = (date: string): string => {
  const dateStr = date.replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `APT-${dateStr}-${randomStr}`;
};

const parseTimeToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
};

const minutesToTimeStr = (totalMinutes: number): string => {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const m = String(totalMinutes % 60).padStart(2, '0');
  return `${h}:${m}`;
};

// Helper: generate time slots between start and end with duration in minutes
const generateTimeWindows = (
  startTime: string,
  endTime: string,
  slotDurationMinutes: number,
  breakStart?: string,
  breakEnd?: string
): Array<{ startTime: string; endTime: string }> => {
  const slots: Array<{ startTime: string; endTime: string }> = [];
  const startTotal = parseTimeToMinutes(startTime);
  const endTotal = parseTimeToMinutes(endTime);

  let breakStartTotal = -1;
  let breakEndTotal = -1;
  if (breakStart && breakEnd) {
    breakStartTotal = parseTimeToMinutes(breakStart);
    breakEndTotal = parseTimeToMinutes(breakEnd);
  }

  let current = startTotal;
  while (current + slotDurationMinutes <= endTotal) {
    const slotStart = current;
    const slotEnd = current + slotDurationMinutes;

    // Check if slot falls in break
    const overlapsBreak =
      breakStartTotal >= 0 &&
      breakEndTotal >= 0 &&
      !(slotEnd <= breakStartTotal || slotStart >= breakEndTotal);

    if (!overlapsBreak) {
      const sh = String(Math.floor(slotStart / 60)).padStart(2, '0');
      const sm = String(slotStart % 60).padStart(2, '0');
      const eh = String(Math.floor(slotEnd / 60)).padStart(2, '0');
      const em = String(slotEnd % 60).padStart(2, '0');
      slots.push({ startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` });
    }

    current += slotDurationMinutes;
  }

  return slots;
};

// 1. Availability Configuration
export const getHospitalAvailability = async (
  hospitalId: string,
  department: string
): Promise<HospitalAppointmentAvailabilityDocument | null> => {
  if (!Types.ObjectId.isValid(hospitalId)) throw new AppError('INVALID_ID', 'Invalid hospital ID', 400);

  return HospitalAppointmentAvailabilityModel.findOne({
    hospitalId: new Types.ObjectId(hospitalId),
    department: department.trim(),
    isActive: true,
  }).lean().exec();
};

export const listHospitalAvailabilities = async (hospitalId: string) => {
  if (!Types.ObjectId.isValid(hospitalId)) throw new AppError('INVALID_ID', 'Invalid hospital ID', 400);

  return HospitalAppointmentAvailabilityModel.find({
    hospitalId: new Types.ObjectId(hospitalId),
  }).sort({ department: 1 }).lean().exec();
};

export const upsertHospitalAvailability = async (
  hospitalId: string,
  input: {
    department: string;
    slotDurationMinutes: number;
    maxCapacityPerSlot: number;
    weeklySchedule: DaySchedule[];
    blackoutDates?: string[];
    isActive?: boolean;
  }
) => {
  if (!Types.ObjectId.isValid(hospitalId)) throw new AppError('INVALID_ID', 'Invalid hospital ID', 400);

  const hospital = await HospitalModel.findById(hospitalId).lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital not found', 404);

  const doc = await HospitalAppointmentAvailabilityModel.findOneAndUpdate(
    {
      hospitalId: new Types.ObjectId(hospitalId),
      department: input.department.trim(),
    },
    {
      $set: {
        slotDurationMinutes: input.slotDurationMinutes,
        maxCapacityPerSlot: input.maxCapacityPerSlot,
        weeklySchedule: input.weeklySchedule,
        blackoutDates: input.blackoutDates ?? [],
        isActive: input.isActive ?? true,
      },
    },
    { returnDocument: 'after', upsert: true }
  ).lean().exec();

  return doc;
};

// 2. Query available slots for a date
export const getAvailableSlotsForDate = async (
  hospitalId: string,
  department: string,
  dateStr: string
) => {
  if (!Types.ObjectId.isValid(hospitalId)) throw new AppError('INVALID_ID', 'Invalid hospital ID', 400);

  const availability = await getHospitalAvailability(hospitalId, department);
  if (!availability || !availability.isActive) {
    return {
      isConfigured: false,
      date: dateStr,
      department,
      slots: [],
    };
  }

  // Blackout date check
  if (availability.blackoutDates?.includes(dateStr)) {
    return {
      isConfigured: true,
      isBlackout: true,
      date: dateStr,
      department,
      slots: [],
    };
  }

  // Get day of week for the date: YYYY-MM-DD
  const parts = dateStr.split('-');
  const year = Number(parts[0] ?? 1970);
  const month = Number(parts[1] ?? 1);
  const day = Number(parts[2] ?? 1);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = targetDate.getUTCDay();

  const daySchedule = availability.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
  if (!daySchedule || !daySchedule.isEnabled) {
    return {
      isConfigured: true,
      isDayOff: true,
      date: dateStr,
      department,
      slots: [],
    };
  }

  // Generate windows
  const timeWindows = generateTimeWindows(
    daySchedule.startTime,
    daySchedule.endTime,
    availability.slotDurationMinutes,
    daySchedule.breakStartTime,
    daySchedule.breakEndTime
  );

  // Retrieve existing slot documents for this hospital, department, date
  const hospitalObjectId = new Types.ObjectId(hospitalId);
  const existingSlots = await HospitalAppointmentSlotModel.find({
    hospitalId: hospitalObjectId,
    department: department.trim(),
    date: dateStr,
  }).lean().exec();

  const slotMap = new Map<string, HospitalAppointmentSlotDocument>();
  for (const s of existingSlots) {
    slotMap.set(s.startTime, s);
  }

  const resultSlots = timeWindows.map((tw) => {
    const existing = slotMap.get(tw.startTime);
    const maxCapacity = existing ? existing.maxCapacity : availability.maxCapacityPerSlot;
    const bookedCount = existing ? existing.bookedCount : 0;
    const availableCapacity = Math.max(0, maxCapacity - bookedCount);
    const isAvailable = availableCapacity > 0 && !(existing?.isCancelled);

    return {
      startTime: tw.startTime,
      endTime: tw.endTime,
      maxCapacity,
      bookedCount,
      availableCapacity,
      isAvailable,
      slotDurationMinutes: availability.slotDurationMinutes,
    };
  });

  return {
    isConfigured: true,
    date: dateStr,
    department,
    slotDurationMinutes: availability.slotDurationMinutes,
    slots: resultSlots,
  };
};

// 3. Concurrency-Safe Atomic Booking
export interface BookAppointmentInput {
  hospitalId: string;
  department: string;
  date: string;
  startTime: string;
  visitReason: string;
  notes?: string;
}

export const bookAppointment = async (
  userId: string,
  input: BookAppointmentInput
): Promise<HospitalAppointmentDocument> => {
  if (!Types.ObjectId.isValid(userId)) throw new AppError('INVALID_ID', 'Invalid user ID', 400);
  if (!Types.ObjectId.isValid(input.hospitalId)) throw new AppError('INVALID_ID', 'Invalid hospital ID', 400);

  const [user, hospital] = await Promise.all([
    UserModel.findById(userId).lean().exec(),
    HospitalModel.findOne({
      _id: input.hospitalId,
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    }).lean().exec(),
  ]);

  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital not found or not active', 404);

  // Check department configuration
  const availability = await getHospitalAvailability(input.hospitalId, input.department);
  if (!availability || !availability.isActive) {
    throw new AppError(
      'APPOINTMENTS_NOT_CONFIGURED',
      `Appointment booking is not configured for ${input.department} at ${hospital.name}. You can submit a direct care request instead.`,
      400
    );
  }

  // Prevent duplicate pending booking by the same user on the same slot
  const userObjectId = new Types.ObjectId(userId);
  const hospitalObjectId = new Types.ObjectId(input.hospitalId);

  const existingPending = await HospitalAppointmentModel.findOne({
    userId: userObjectId,
    hospitalId: hospitalObjectId,
    serviceDepartment: input.department.trim(),
    slotDate: input.date,
    startTime: input.startTime,
    status: { $in: ['PENDING', 'CONFIRMED'] },
  }).lean().exec();

  if (existingPending) {
    throw new AppError(
      'DUPLICATE_BOOKING',
      'You already have an active appointment or pending booking for this time slot.',
      409
    );
  }

  // Compute endTime based on slotDurationMinutes
  const startMinutes = parseTimeToMinutes(input.startTime);
  const endMinutes = startMinutes + availability.slotDurationMinutes;
  const endTime = minutesToTimeStr(endMinutes);

  // Ensure slot document exists before atomic increment
  let slotDoc = await HospitalAppointmentSlotModel.findOne({
    hospitalId: hospitalObjectId,
    department: input.department.trim(),
    date: input.date,
    startTime: input.startTime,
  }).exec();

  if (!slotDoc) {
    try {
      slotDoc = await HospitalAppointmentSlotModel.create({
        hospitalId: hospitalObjectId,
        department: input.department.trim(),
        date: input.date,
        startTime: input.startTime,
        endTime,
        maxCapacity: availability.maxCapacityPerSlot,
        bookedCount: 0,
        isCancelled: false,
      });
    } catch {
      // If concurrent insert created it, fetch the created slot
      slotDoc = await HospitalAppointmentSlotModel.findOne({
        hospitalId: hospitalObjectId,
        department: input.department.trim(),
        date: input.date,
        startTime: input.startTime,
      }).exec();
    }
  }

  if (!slotDoc) {
    throw new AppError('SLOT_NOT_FOUND', 'Could not initialize appointment slot', 500);
  }

  // ATOMIC RESERVATION: increment bookedCount only if bookedCount < maxCapacity
  const reservedSlot = await HospitalAppointmentSlotModel.findOneAndUpdate(
    {
      _id: slotDoc._id,
      bookedCount: { $lt: slotDoc.maxCapacity },
      isCancelled: false,
    },
    {
      $inc: { bookedCount: 1 },
    },
    { returnDocument: 'after' }
  ).exec();

  if (!reservedSlot) {
    throw new AppError(
      'SLOT_UNAVAILABLE',
      'The requested time slot has reached full capacity and is no longer available. Please select another slot.',
      409
    );
  }

  // Create appointment record
  const appointmentCode = generateAppointmentCode(input.date);
  const now = new Date();

  try {
    const appointment = await HospitalAppointmentModel.create({
      appointmentCode,
      userId: userObjectId,
      hospitalId: hospitalObjectId,
      slotId: reservedSlot._id,
      serviceDepartment: input.department.trim(),
      slotDate: input.date,
      startTime: input.startTime,
      endTime,
      slotDurationMinutes: availability.slotDurationMinutes,
      status: 'PENDING',
      visitReason: input.visitReason.trim(),
      notes: input.notes?.trim(),
      statusHistory: [
        {
          status: 'PENDING',
          timestamp: now,
          updatedBy: userObjectId,
          role: 'USER',
          reason: 'Appointment requested by citizen',
        },
      ],
    });

    // Notify hospital
    await createAndDispatchCareNotification({
      recipientType: 'HOSPITAL',
      recipientId: hospitalObjectId,
      appointmentId: appointment._id,
      type: 'APPOINTMENT_BOOKED',
      title: 'New Appointment Booking',
      message: `${user.name} booked an appointment for ${input.department} on ${input.date} at ${input.startTime} (${appointmentCode}).`,
    });

    return appointment;
  } catch (error) {
    // If appointment document creation fails, roll back the slot reservation count
    await HospitalAppointmentSlotModel.findOneAndUpdate(
      { _id: reservedSlot._id, bookedCount: { $gt: 0 } },
      { $inc: { bookedCount: -1 } }
    ).exec();
    throw error;
  }
};

// 4. Citizen Appointment Queries & Actions
export const listUserAppointments = async (
  userId: string,
  query: { page?: number; limit?: number; status?: AppointmentStatus; date?: string; department?: string }
) => {
  if (!Types.ObjectId.isValid(userId)) throw new AppError('INVALID_ID', 'Invalid user ID', 400);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
  };
  if (query.status) filter.status = query.status;
  if (query.date) filter.slotDate = query.date;
  if (query.department) filter.serviceDepartment = new RegExp(query.department, 'i');

  const [items, total] = await Promise.all([
    HospitalAppointmentModel.find(filter)
      .populate('hospitalId', 'name phone address city emergencyAvailability')
      .sort({ slotDate: -1, startTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    HospitalAppointmentModel.countDocuments(filter).exec(),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: total ? Math.ceil(total / limit) : 0,
    },
  };
};

export const getUserAppointmentById = async (userId: string, appointmentId: string) => {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const doc = await HospitalAppointmentModel.findOne({
    _id: new Types.ObjectId(appointmentId),
    userId: new Types.ObjectId(userId),
  })
    .populate('hospitalId', 'name phone address city state emergencyAvailability')
    .lean()
    .exec();

  if (!doc) throw new AppError('NOT_FOUND', 'Appointment not found', 404);
  return doc;
};

export const cancelUserAppointment = async (
  userId: string,
  appointmentId: string,
  cancellationReason?: string
) => {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const appointment = await HospitalAppointmentModel.findOne({
    _id: new Types.ObjectId(appointmentId),
    userId: new Types.ObjectId(userId),
  }).exec();

  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

  const cancellableStatuses: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'ALTERNATIVE_PROPOSED'];
  if (!cancellableStatuses.includes(appointment.status)) {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot cancel appointment with status '${appointment.status}'. Only PENDING, CONFIRMED, or ALTERNATIVE_PROPOSED appointments can be cancelled.`,
      400
    );
  }

  appointment.status = 'CANCELLED';
  appointment.cancellationReason = cancellationReason || 'Cancelled by citizen';
  appointment.statusHistory.push({
    status: 'CANCELLED',
    timestamp: new Date(),
    updatedBy: new Types.ObjectId(userId),
    role: 'USER',
    reason: cancellationReason || 'Cancelled by citizen',
  });

  await appointment.save();

  // ATOMIC CAPACITY RELEASE
  if (appointment.slotId) {
    await HospitalAppointmentSlotModel.findOneAndUpdate(
      { _id: appointment.slotId, bookedCount: { $gt: 0 } },
      { $inc: { bookedCount: -1 } }
    ).exec();
  }

  // Notify hospital
  await createAndDispatchCareNotification({
    recipientType: 'HOSPITAL',
    recipientId: appointment.hospitalId,
    appointmentId: appointment._id,
    type: 'APPOINTMENT_CANCELLED',
    title: 'Appointment Cancelled',
    message: `Appointment ${appointment.appointmentCode} on ${appointment.slotDate} was cancelled by the patient.`,
  });

  return appointment;
};

// 5. Hospital Staff Appointment Management
export const listHospitalAppointments = async (
  hospitalId: string,
  query: { page?: number; limit?: number; status?: AppointmentStatus; date?: string; department?: string }
) => {
  if (!Types.ObjectId.isValid(hospitalId)) throw new AppError('INVALID_ID', 'Invalid hospital ID', 400);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter: Record<string, unknown> = {
    hospitalId: new Types.ObjectId(hospitalId),
  };
  if (query.status) filter.status = query.status;
  if (query.date) filter.slotDate = query.date;
  if (query.department) filter.serviceDepartment = new RegExp(query.department, 'i');

  const [items, total] = await Promise.all([
    HospitalAppointmentModel.find(filter)
      .populate('userId', 'name email phone')
      .sort({ slotDate: 1, startTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    HospitalAppointmentModel.countDocuments(filter).exec(),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: total ? Math.ceil(total / limit) : 0,
    },
  };
};

export const getHospitalAppointmentById = async (hospitalId: string, appointmentId: string) => {
  if (!Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const doc = await HospitalAppointmentModel.findOne({
    _id: new Types.ObjectId(appointmentId),
    hospitalId: new Types.ObjectId(hospitalId),
  })
    .populate('userId', 'name email phone')
    .lean()
    .exec();

  if (!doc) throw new AppError('NOT_FOUND', 'Appointment not found or access denied', 404);
  return doc;
};

export const confirmHospitalAppointment = async (
  hospitalId: string,
  appointmentId: string,
  notes?: string
) => {
  if (!Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const appointment = await HospitalAppointmentModel.findOne({
    _id: new Types.ObjectId(appointmentId),
    hospitalId: new Types.ObjectId(hospitalId),
  }).exec();

  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found or access denied', 404);
  if (appointment.status !== 'PENDING') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot confirm appointment with status '${appointment.status}'. Only PENDING appointments can be confirmed.`,
      400
    );
  }

  const hospitalObjectId = new Types.ObjectId(hospitalId);
  const now = new Date();

  appointment.status = 'CONFIRMED';
  if (notes) appointment.notes = notes;
  appointment.statusHistory.push({
    status: 'CONFIRMED',
    timestamp: now,
    updatedBy: hospitalObjectId,
    role: 'HOSPITAL',
    notes,
    reason: 'Confirmed by hospital staff',
  });

  await appointment.save();

  // Notify citizen
  await createAndDispatchCareNotification({
    recipientType: 'USER',
    recipientId: appointment.userId,
    appointmentId: appointment._id,
    type: 'APPOINTMENT_CONFIRMED',
    title: 'Appointment Confirmed',
    message: `Your appointment (${appointment.appointmentCode}) on ${appointment.slotDate} at ${appointment.startTime} has been confirmed. ${notes || ''}`.trim(),
  });

  return appointment;
};

export const rejectHospitalAppointment = async (
  hospitalId: string,
  appointmentId: string,
  rejectionReason: string
) => {
  if (!Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const appointment = await HospitalAppointmentModel.findOne({
    _id: new Types.ObjectId(appointmentId),
    hospitalId: new Types.ObjectId(hospitalId),
  }).exec();

  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found or access denied', 404);
  if (appointment.status !== 'PENDING' && appointment.status !== 'CONFIRMED') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot reject appointment with status '${appointment.status}'.`,
      400
    );
  }

  const hospitalObjectId = new Types.ObjectId(hospitalId);
  const now = new Date();

  appointment.status = 'REJECTED';
  appointment.rejectionReason = rejectionReason;
  appointment.statusHistory.push({
    status: 'REJECTED',
    timestamp: now,
    updatedBy: hospitalObjectId,
    role: 'HOSPITAL',
    reason: rejectionReason,
  });

  await appointment.save();

  // ATOMIC CAPACITY RELEASE
  if (appointment.slotId) {
    await HospitalAppointmentSlotModel.findOneAndUpdate(
      { _id: appointment.slotId, bookedCount: { $gt: 0 } },
      { $inc: { bookedCount: -1 } }
    ).exec();
  }

  // Notify citizen
  await createAndDispatchCareNotification({
    recipientType: 'USER',
    recipientId: appointment.userId,
    appointmentId: appointment._id,
    type: 'APPOINTMENT_REJECTED',
    title: 'Appointment Declined',
    message: `Your appointment request (${appointment.appointmentCode}) was declined: ${rejectionReason}`,
  });

  return appointment;
};

export const proposeAlternativeSlot = async (
  hospitalId: string,
  appointmentId: string,
  input: { date: string; startTime: string; notes?: string }
) => {
  if (!Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const appointment = await HospitalAppointmentModel.findOne({
    _id: new Types.ObjectId(appointmentId),
    hospitalId: new Types.ObjectId(hospitalId),
  }).exec();

  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found or access denied', 404);
  if (appointment.status !== 'PENDING') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot propose alternative slot for appointment in status '${appointment.status}'. Only PENDING appointments are eligible.`,
      400
    );
  }

  const hospitalObjectId = new Types.ObjectId(hospitalId);
  const now = new Date();

  // Compute endTime
  const startMinutes = parseTimeToMinutes(input.startTime);
  const endMinutes = startMinutes + appointment.slotDurationMinutes;
  const endTime = minutesToTimeStr(endMinutes);

  appointment.status = 'ALTERNATIVE_PROPOSED';
  appointment.alternativeSlot = {
    date: input.date,
    startTime: input.startTime,
    endTime,
    notes: input.notes,
    proposedAt: now,
    proposedBy: hospitalObjectId,
  };
  appointment.statusHistory.push({
    status: 'ALTERNATIVE_PROPOSED',
    timestamp: now,
    updatedBy: hospitalObjectId,
    role: 'HOSPITAL',
    reason: `Proposed alternative time: ${input.date} at ${input.startTime}. ${input.notes || ''}`.trim(),
  });

  await appointment.save();

  // Notify citizen
  await createAndDispatchCareNotification({
    recipientType: 'USER',
    recipientId: appointment.userId,
    appointmentId: appointment._id,
    type: 'APPOINTMENT_ALTERNATIVE_PROPOSED',
    title: 'Alternative Appointment Proposed',
    message: `Hospital proposed an alternative time for appointment ${appointment.appointmentCode}: ${input.date} at ${input.startTime}. ${input.notes || ''}`.trim(),
  });

  return appointment;
};

export const completeHospitalAppointment = async (
  hospitalId: string,
  appointmentId: string
) => {
  if (!Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(appointmentId)) {
    throw new AppError('INVALID_ID', 'Invalid ID provided', 400);
  }

  const appointment = await HospitalAppointmentModel.findOne({
    _id: new Types.ObjectId(appointmentId),
    hospitalId: new Types.ObjectId(hospitalId),
  }).exec();

  if (!appointment) throw new AppError('NOT_FOUND', 'Appointment not found or access denied', 404);
  if (appointment.status !== 'CONFIRMED') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot complete appointment with status '${appointment.status}'. Only CONFIRMED appointments can be completed.`,
      400
    );
  }

  const hospitalObjectId = new Types.ObjectId(hospitalId);
  const now = new Date();

  appointment.status = 'COMPLETED';
  appointment.statusHistory.push({
    status: 'COMPLETED',
    timestamp: now,
    updatedBy: hospitalObjectId,
    role: 'HOSPITAL',
    reason: 'Visit completed',
  });

  await appointment.save();

  // Notify citizen
  await createAndDispatchCareNotification({
    recipientType: 'USER',
    recipientId: appointment.userId,
    appointmentId: appointment._id,
    type: 'APPOINTMENT_COMPLETED',
    title: 'Appointment Completed',
    message: `Your appointment (${appointment.appointmentCode}) has been marked completed. Thank you for visiting!`,
  });

  return appointment;
};
