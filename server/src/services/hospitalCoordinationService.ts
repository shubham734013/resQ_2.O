import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { HospitalCoordinationNotificationModel, type HospitalCoordinationNotificationDocument, type HospitalCoordinationNotificationType } from '../models/HospitalCoordinationNotification.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { TripModel } from '../models/Trip.js';
import { AppError } from '../utils/AppError.js';
import { broadcastEvent } from './realtimeService.js';

const ACTIVE_TRIP_STATUSES = ['ASSIGNED', 'ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'] as const;
const MATERIAL_TRANSPORT_STATUSES = ['TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'] as const;
const idOf = (value: string, label: string) => {
  if (!Types.ObjectId.isValid(value)) throw new AppError('INVALID_ID', `Invalid ${label} ID.`, 400);
  return new Types.ObjectId(value);
};
const isDuplicateKey = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

const copy = (value: Record<string, unknown> & { _id: Types.ObjectId }) => ({
  id: String(value._id), hospitalId: String(value.hospitalId), emergencyId: String(value.emergencyId),
  tripId: value.tripId ? String(value.tripId) : undefined, ambulanceId: value.ambulanceId ? String(value.ambulanceId) : undefined,
  ambulanceRegistration: typeof value.ambulanceRegistration === 'string' ? value.ambulanceRegistration : undefined,
  ambulanceVehicleNumber: typeof value.ambulanceVehicleNumber === 'string' ? value.ambulanceVehicleNumber : undefined,
  type: value.type as HospitalCoordinationNotificationType, state: value.state as 'UNREAD' | 'ACKNOWLEDGED' | 'SUPERSEDED',
  requestCode: String(value.requestCode), emergencyCategory: String(value.emergencyCategory), tripStatus: value.tripStatus,
  title: String(value.title), message: String(value.message), etaMinutes: typeof value.etaMinutes === 'number' ? value.etaMinutes : undefined,
  acknowledgedAt: value.acknowledgedAt, createdAt: value.createdAt, updatedAt: value.updatedAt,
  deliveryAttemptCount: typeof value.deliveryAttemptCount === 'number' ? value.deliveryAttemptCount : 0,
  lastDeliveryAttemptAt: value.lastDeliveryAttemptAt,
});

const eventTripStatus: Partial<Record<HospitalCoordinationNotificationType, string>> = {
  AMBULANCE_ASSIGNED: 'ACCEPTED', AMBULANCE_REASSIGNED: 'ACCEPTED', AMBULANCE_AT_PICKUP: 'AT_PICKUP',
  PATIENT_PICKED_UP: 'PATIENT_ONBOARD', EN_ROUTE_TO_HOSPITAL: 'TO_HOSPITAL', AMBULANCE_ARRIVED: 'AT_HOSPITAL',
  TRIP_COMPLETED: 'COMPLETED', TRIP_CANCELLED: 'CANCELLED', EMERGENCY_CANCELLED: 'CANCELLED',
};
const eventCopy: Record<HospitalCoordinationNotificationType, { title: string; message: (code: string, eta?: number) => string }> = {
  EMERGENCY_RECEIVED: { title: 'New emergency request', message: (code) => `Emergency ${code} requires hospital review.` },
  EMERGENCY_CANCELLED: { title: 'Emergency cancelled', message: (code) => `Emergency ${code} was cancelled. Do not prepare for this arrival.` },
  AMBULANCE_ASSIGNED: { title: 'Ambulance assigned', message: (code, eta) => `An ambulance accepted emergency ${code}.${eta === undefined ? '' : ` Estimated arrival: ${eta} min.`}` },
  AMBULANCE_REASSIGNED: { title: 'Ambulance reassigned', message: (code, eta) => `The ambulance assigned to emergency ${code} changed.${eta === undefined ? '' : ` Current estimated arrival: ${eta} min.`}` },
  AMBULANCE_AT_PICKUP: { title: 'Ambulance at pickup', message: (code) => `The ambulance for emergency ${code} has arrived at the pickup point.` },
  PATIENT_PICKED_UP: { title: 'Patient picked up', message: (code) => `The patient for emergency ${code} has been picked up.` },
  EN_ROUTE_TO_HOSPITAL: { title: 'Patient en route', message: (code, eta) => `The patient for emergency ${code} is en route to your hospital.${eta === undefined ? '' : ` Estimated arrival: ${eta} min.`}` },
  AMBULANCE_ARRIVED: { title: 'Ambulance arrived', message: (code) => `The ambulance for emergency ${code} has arrived at the hospital.` },
  TRIP_COMPLETED: { title: 'Trip completed', message: (code) => `The ambulance trip for emergency ${code} is complete.` },
  TRIP_CANCELLED: { title: 'Ambulance trip cancelled', message: (code) => `The assigned trip for emergency ${code} was cancelled before transport. A new assignment may be required.` },
};

export const hospitalNotificationTypeForTripStatus = (status: string): HospitalCoordinationNotificationType | null => ({
  ACCEPTED: 'AMBULANCE_ASSIGNED', AT_PICKUP: 'AMBULANCE_AT_PICKUP', PATIENT_ONBOARD: 'PATIENT_PICKED_UP',
  TO_HOSPITAL: 'EN_ROUTE_TO_HOSPITAL', AT_HOSPITAL: 'AMBULANCE_ARRIVED', COMPLETED: 'TRIP_COMPLETED', CANCELLED: 'TRIP_CANCELLED',
} as Partial<Record<string, HospitalCoordinationNotificationType>>)[status] ?? null;

const updatePatientForEvent = async (hospitalId: Types.ObjectId, emergencyId: Types.ObjectId, type: HospitalCoordinationNotificationType, ambulanceId?: Types.ObjectId, etaMinutes?: number) => {
  const filter = { hospitalId, emergencyId };
  if (type === 'AMBULANCE_ASSIGNED' || type === 'AMBULANCE_REASSIGNED') {
    await HospitalPatientModel.updateOne({ ...filter, coordinationStatus: { $nin: ['RESOLVED', 'CANCELLED'] } }, {
      $set: { coordinationStatus: 'HOSPITAL_NOTIFIED', ...(ambulanceId ? { ambulanceId } : {}), ...(etaMinutes !== undefined ? { etaMinutes } : {}) },
    }).exec();
  } else if (type === 'AMBULANCE_ARRIVED') {
    await HospitalPatientModel.updateOne({ ...filter, coordinationStatus: { $nin: ['RESOLVED', 'CANCELLED'] } }, { $set: { coordinationStatus: 'AT_HOSPITAL' } }).exec();
  } else if (type === 'TRIP_COMPLETED') {
    await HospitalPatientModel.updateOne(filter, { $set: { coordinationStatus: 'RESOLVED' } }).exec();
  } else if (type === 'TRIP_CANCELLED') {
    await HospitalPatientModel.updateOne({ ...filter, coordinationStatus: { $nin: ['RESOLVED', 'CANCELLED'] } }, { $set: { coordinationStatus: 'REASSIGNMENT_REQUIRED' }, $unset: { ambulanceId: 1, etaMinutes: 1 } }).exec();
  } else if (type === 'EMERGENCY_CANCELLED') {
    await HospitalPatientModel.updateOne(filter, { $set: { coordinationStatus: 'CANCELLED' }, $unset: { ambulanceId: 1, etaMinutes: 1 } }).exec();
  }
};

type RecordInput = { emergencyId: string; tripId?: string; type: HospitalCoordinationNotificationType };
export const recordHospitalCoordinationEvent = async ({ emergencyId, tripId, type }: RecordInput) => {
  const emergencyObjectId = idOf(emergencyId, 'emergency');
  const emergency = await EmergencyRequestModel.findById(emergencyObjectId).select('_id hospitalId requestCode situationType category status etaMinutes').lean().exec();
  if (!emergency) throw new AppError('NOT_FOUND', 'Emergency request not found for hospital coordination.', 404);
  if (emergency.status === 'CANCELLED' && type !== 'EMERGENCY_CANCELLED') return null;

  const trip = tripId
    ? await TripModel.findOne({ _id: idOf(tripId, 'trip'), emergencyRequestId: emergencyObjectId, destinationHospitalId: emergency.hospitalId }).select('_id status ambulanceId destinationHospitalId').lean().exec()
    : await TripModel.findOne({ emergencyRequestId: emergencyObjectId, destinationHospitalId: emergency.hospitalId }).sort({ createdAt: -1 }).select('_id status ambulanceId destinationHospitalId').lean().exec();
  if (tripId && !trip) throw new AppError('COORDINATION_TRIP_MISMATCH', 'Trip does not belong to this hospital emergency.', 409);
  if (trip && String(trip.destinationHospitalId) !== String(emergency.hospitalId)) throw new AppError('COORDINATION_HOSPITAL_MISMATCH', 'Trip destination does not match the selected hospital.', 409);

  const ambulanceId = trip?.ambulanceId;
  let effectiveType = type;
  if (type === 'AMBULANCE_ASSIGNED' && ambulanceId && trip) {
    const assignmentTypes: HospitalCoordinationNotificationType[] = ['AMBULANCE_ASSIGNED', 'AMBULANCE_REASSIGNED'];
    const currentTripAssignment = await HospitalCoordinationNotificationModel.findOne({
      hospitalId: emergency.hospitalId, emergencyId: emergencyObjectId, tripId: trip._id, ambulanceId,
      type: { $in: assignmentTypes },
    }).sort({ createdAt: -1 }).select('type').lean().exec();
    if (currentTripAssignment) {
      // Reconciliation must preserve the original event type instead of creating a second "assigned" alert for a reassignment.
      effectiveType = currentTripAssignment.type as HospitalCoordinationNotificationType;
    } else {
      const previousAssignment = await HospitalCoordinationNotificationModel.findOne({
        hospitalId: emergency.hospitalId, emergencyId: emergencyObjectId, tripId: { $ne: trip._id },
        createdAt: { $lt: trip.createdAt }, type: { $in: assignmentTypes }, ambulanceId: { $exists: true },
      }).sort({ createdAt: -1 }).select('ambulanceId').lean().exec();
      if (previousAssignment && String(previousAssignment.ambulanceId) !== String(ambulanceId)) effectiveType = 'AMBULANCE_REASSIGNED';
    }
  }
  const descriptor = eventCopy[effectiveType];
  const dedupeKey = `${String(emergency.hospitalId)}:${String(emergencyObjectId)}:${trip ? String(trip._id) : 'no-trip'}:${effectiveType}:${ambulanceId ? String(ambulanceId) : 'none'}`;
  const existing = await HospitalCoordinationNotificationModel.findOne({ dedupeKey }).lean().exec();
  if (existing) {
    await updatePatientForEvent(emergency.hospitalId, emergencyObjectId, effectiveType, ambulanceId, emergency.etaMinutes);
    return copy(existing as unknown as Record<string, unknown> & { _id: Types.ObjectId });
  }

  const ambulance = ambulanceId ? await AmbulanceModel.findById(ambulanceId).select('registrationNumber vehicleNumber').lean().exec() : null;
  let created: HospitalCoordinationNotificationDocument & { _id: Types.ObjectId };
  try {
    const docs = await HospitalCoordinationNotificationModel.create([{
      hospitalId: emergency.hospitalId, emergencyId: emergencyObjectId, tripId: trip?._id, ambulanceId,
      ambulanceRegistration: ambulance?.registrationNumber, ambulanceVehicleNumber: ambulance?.vehicleNumber,
      dedupeKey, type: effectiveType, state: 'UNREAD', requestCode: emergency.requestCode,
      emergencyCategory: emergency.category ?? emergency.situationType, tripStatus: eventTripStatus[effectiveType] ?? trip?.status,
      title: descriptor.title, message: descriptor.message(emergency.requestCode, emergency.etaMinutes),
      etaMinutes: emergency.etaMinutes, deliveryAttemptCount: 0,
    }]);
    created = docs[0]!;
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const duplicate = await HospitalCoordinationNotificationModel.findOne({ dedupeKey }).lean().exec();
    if (!duplicate) throw error;
    await updatePatientForEvent(emergency.hospitalId, emergencyObjectId, effectiveType, ambulanceId, emergency.etaMinutes);
    return copy(duplicate as unknown as Record<string, unknown> & { _id: Types.ObjectId });
  }

  await updatePatientForEvent(emergency.hospitalId, emergencyObjectId, effectiveType, ambulanceId, emergency.etaMinutes);
  await HospitalCoordinationNotificationModel.updateMany({ hospitalId: emergency.hospitalId, emergencyId: emergencyObjectId, _id: { $ne: created._id }, state: 'UNREAD' }, { $set: { state: 'SUPERSEDED' } }).exec();
  await HospitalCoordinationNotificationModel.updateOne({ _id: created._id }, { $inc: { deliveryAttemptCount: 1 }, $set: { lastDeliveryAttemptAt: new Date() } }).exec();
  try {
    broadcastEvent(`hospital:${emergency.hospitalId}`, 'hospital:coordination-notification', {
      id: String(created._id), hospitalId: String(emergency.hospitalId), emergencyId: String(emergencyObjectId),
      tripId: trip ? String(trip._id) : undefined, type: effectiveType, state: 'UNREAD',
      requestCode: emergency.requestCode, emergencyCategory: emergency.category ?? emergency.situationType,
      tripStatus: eventTripStatus[effectiveType] ?? trip?.status, title: descriptor.title, message: descriptor.message(emergency.requestCode, emergency.etaMinutes),
      ambulanceId: ambulanceId ? String(ambulanceId) : undefined,
      ambulanceRegistration: ambulance?.registrationNumber, ambulanceVehicleNumber: ambulance?.vehicleNumber,
      etaMinutes: emergency.etaMinutes, createdAt: created.createdAt,
    });
  } catch {
    // Realtime is best-effort; persisted inbox state is recovered from REST on refresh/reconnect.
  }
  return copy(created as unknown as Record<string, unknown> & { _id: Types.ObjectId });
};

export const reconcileHospitalCoordination = async (hospitalId: string) => {
  const hospitalObjectId = idOf(hospitalId, 'hospital');
  const emergencies = await EmergencyRequestModel.find({ hospitalId: hospitalObjectId }).select('_id status updatedAt').sort({ updatedAt: -1 }).limit(100).lean().exec();
  for (const emergency of emergencies) {
    if (emergency.status === 'CANCELLED') {
      await recordHospitalCoordinationEvent({ emergencyId: String(emergency._id), type: 'EMERGENCY_CANCELLED' });
      continue;
    }
    const trips = await TripModel.find({ emergencyRequestId: emergency._id, destinationHospitalId: hospitalObjectId }).sort({ createdAt: 1 }).select('_id status ambulanceId statusHistory createdAt').lean().exec();
    if (!trips.length) {
      await recordHospitalCoordinationEvent({ emergencyId: String(emergency._id), type: 'EMERGENCY_RECEIVED' });
      continue;
    }
    for (const trip of trips) {
      const statuses = (trip.statusHistory ?? []).map((entry) => entry.status);
      if (trip.status && !statuses.includes(trip.status)) statuses.push(trip.status);
      for (const status of statuses) {
        const eventType = hospitalNotificationTypeForTripStatus(status);
        if (eventType) await recordHospitalCoordinationEvent({ emergencyId: String(emergency._id), tripId: String(trip._id), type: eventType });
      }
    }
  }
};

export const listHospitalCoordinationNotifications = async (hospitalId: string, query: { state: 'UNREAD' | 'ACKNOWLEDGED' | 'SUPERSEDED' | 'ALL'; page: number; limit: number }) => {
  await reconcileHospitalCoordination(hospitalId);
  const hospitalObjectId = idOf(hospitalId, 'hospital');
  const filter: Record<string, unknown> = { hospitalId: hospitalObjectId };
  if (query.state !== 'ALL') filter.state = query.state;
  const [items, total, unreadCount] = await Promise.all([
    HospitalCoordinationNotificationModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    HospitalCoordinationNotificationModel.countDocuments(filter).exec(),
    HospitalCoordinationNotificationModel.countDocuments({ hospitalId: hospitalObjectId, state: 'UNREAD' }).exec(),
  ]);
  return { items: items.map((item) => copy(item as unknown as Record<string, unknown> & { _id: Types.ObjectId })), unreadCount, pagination: { page: query.page, limit: query.limit, total, totalPages: total ? Math.ceil(total / query.limit) : 0 } };
};

export const acknowledgeHospitalCoordinationNotification = async (hospitalId: string, notificationId: string, actorId: string) => {
  const hospitalObjectId = idOf(hospitalId, 'hospital');
  const notificationObjectId = idOf(notificationId, 'notification');
  const actorObjectId = idOf(actorId, 'hospital actor');
  const updated = await HospitalCoordinationNotificationModel.findOneAndUpdate({ _id: notificationObjectId, hospitalId: hospitalObjectId, state: 'UNREAD' }, { $set: { state: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: actorObjectId } }, { new: true }).lean().exec();
  if (updated) {
    try {
      broadcastEvent(`hospital:${hospitalObjectId}`, 'hospital:coordination-notification-acknowledged', {
        id: String(updated._id), hospitalId: String(hospitalObjectId), emergencyId: String(updated.emergencyId),
        state: 'ACKNOWLEDGED', acknowledgedAt: updated.acknowledgedAt,
      });
    } catch {
      // Acknowledgement is already persisted; other sessions recover it through the inbox endpoint.
    }
    return copy(updated as unknown as Record<string, unknown> & { _id: Types.ObjectId });
  }
  const existing = await HospitalCoordinationNotificationModel.findOne({ _id: notificationObjectId, hospitalId: hospitalObjectId }).lean().exec();
  if (!existing) throw new AppError('NOT_FOUND', 'Coordination notification not found.', 404);
  return copy(existing as unknown as Record<string, unknown> & { _id: Types.ObjectId });
};

export const getHospitalCoordinationDetail = async (hospitalId: string, emergencyId: string) => {
  const hospitalObjectId = idOf(hospitalId, 'hospital');
  const emergencyObjectId = idOf(emergencyId, 'emergency');
  const emergency = await EmergencyRequestModel.findOne({ _id: emergencyObjectId, hospitalId: hospitalObjectId }).select('requestCode situationType category reportedAt location latitude longitude status etaMinutes updatedAt').lean().exec();
  if (!emergency) throw new AppError('NOT_FOUND', 'Emergency coordination record not found.', 404);
  const [patient, trip] = await Promise.all([
    HospitalPatientModel.findOne({ emergencyId: emergencyObjectId, hospitalId: hospitalObjectId }).select('caseId coordinationStatus receivedAt etaMinutes').lean().exec(),
    TripModel.findOne({ emergencyRequestId: emergencyObjectId, destinationHospitalId: hospitalObjectId }).sort({ createdAt: -1 }).lean().exec(),
  ]);
  const isActive = Boolean(trip && (ACTIVE_TRIP_STATUSES as readonly string[]).includes(trip.status));
  let ambulance: Record<string, unknown> | null = null;
  if (trip && trip.status !== 'ASSIGNED' && trip.status !== 'CANCELLED') {
    const vehicle = await AmbulanceModel.findById(trip.ambulanceId).select('registrationNumber vehicleNumber ambulanceType currentStatus currentLatitude currentLongitude locationUpdatedAt locationAccuracyMeters').lean().exec();
    if (vehicle) {
      const timestamp = vehicle.locationUpdatedAt ? new Date(vehicle.locationUpdatedAt).getTime() : NaN;
      const ageMs = Date.now() - timestamp;
      const fresh = isActive && Number.isFinite(timestamp) && ageMs >= 0 && ageMs <= env.DRIVER_LOCATION_STALE_AFTER_MS;
      ambulance = { id: String(trip.ambulanceId), registrationNumber: vehicle.registrationNumber, vehicleNumber: vehicle.vehicleNumber, ambulanceType: vehicle.ambulanceType, currentStatus: vehicle.currentStatus,
        location: typeof vehicle.currentLatitude === 'number' && typeof vehicle.currentLongitude === 'number' ? { latitude: vehicle.currentLatitude, longitude: vehicle.currentLongitude, accuracyMeters: vehicle.locationAccuracyMeters, updatedAt: vehicle.locationUpdatedAt, ageMs: Number.isFinite(ageMs) ? Math.max(0, ageMs) : undefined, freshness: fresh ? 'FRESH' : 'STALE', coordinatesAreLive: fresh } : null };
    }
  }
  const activeStatuses = Boolean(trip && (ACTIVE_TRIP_STATUSES as readonly string[]).includes(trip.status));
  const allowedActions: string[] = [];
  if (emergency.status === 'RECEIVED') allowedActions.push('REVIEWING', 'CANCELLED');
  if (emergency.status === 'REVIEWING') allowedActions.push('PREPARING', 'CANCELLED');
  if (emergency.status === 'PREPARING') allowedActions.push('AMBULANCE_COORDINATION', ...(!activeStatuses ? ['RESOLVED'] : []), 'CANCELLED');
  if (emergency.status === 'AMBULANCE_COORDINATION') {
    if (!activeStatuses) allowedActions.push('RESOLVED');
    if (!trip || !(MATERIAL_TRANSPORT_STATUSES as readonly string[]).includes(trip.status)) allowedActions.push('CANCELLED');
  }
  return {
    emergency: { id: String(emergency._id), requestCode: emergency.requestCode, category: emergency.category ?? emergency.situationType, situationType: emergency.situationType, reportedAt: emergency.reportedAt, status: emergency.status, pickup: { label: emergency.location, latitude: emergency.latitude, longitude: emergency.longitude }, etaMinutes: emergency.etaMinutes },
    patient: patient ? { caseId: patient.caseId, coordinationStatus: patient.coordinationStatus, receivedAt: patient.receivedAt, etaMinutes: patient.etaMinutes } : null,
    trip: trip ? { id: String(trip._id), status: trip.status, acceptedAt: trip.acceptedAt, arrivedAtPickupAt: trip.arrivedAtPickupAt, patientPickedUpAt: trip.patientPickedUpAt, arrivedAtHospitalAt: trip.arrivedAtHospitalAt, completedAt: trip.completedAt, createdAt: trip.createdAt, updatedAt: trip.updatedAt, history: trip.statusHistory ?? [] } : null,
    ambulance, allowedActions, freshnessThresholdMs: env.DRIVER_LOCATION_STALE_AFTER_MS,
  };
};
