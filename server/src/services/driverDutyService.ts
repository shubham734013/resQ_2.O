import { startSession, Types } from 'mongoose';
import { env } from '../config/env.js';
import { AmbulanceDriverModel, type AmbulanceDriverDocument } from '../models/AmbulanceDriver.js';
import { AmbulanceModel, type AmbulanceDocument } from '../models/Ambulance.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { TripModel } from '../models/Trip.js';
import { DispatchJobModel } from '../models/DispatchJob.js';
import { broadcastEvent } from './realtimeService.js';
import { AppError } from '../utils/AppError.js';
import type { z } from 'zod';
import type { ambulanceLocationUpdateSchema } from '../schemas/ambulance.js';

type LocationInput = z.infer<typeof ambulanceLocationUpdateSchema>;
const ACTIVE_TRIP_STATUSES = ['ASSIGNED', 'ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'] as const;
const MAX_FUTURE_SKEW_MS = 5_000;
const MAX_LOCATION_SPEED_MPS = 80;
const oid = (value: string, name = 'id') => {
  if (!Types.ObjectId.isValid(value)) throw new AppError('INVALID_ID', `Invalid ${name}`, 400);
  return new Types.ObjectId(value);
};

export const driverDutyStateForAvailability = (status: string): 'OFF_DUTY' | 'AVAILABLE' | 'BUSY' => {
  if (status === 'ONLINE') return 'AVAILABLE';
  if (status === 'BUSY') return 'BUSY';
  return 'OFF_DUTY';
};
export const locationFreshnessFor = (updatedAt: Date | undefined | null, now = new Date()) =>
  updatedAt instanceof Date && now.getTime() - updatedAt.getTime() >= 0 && now.getTime() - updatedAt.getTime() <= env.DRIVER_LOCATION_STALE_AFTER_MS ? 'FRESH' as const : 'STALE' as const;

export const validateLocationTimestamp = (timestamp: Date, now = new Date()) => {
  if (!(timestamp instanceof Date) || !Number.isFinite(timestamp.getTime())) {
    throw new AppError('INVALID_LOCATION_TIMESTAMP', 'GPS timestamp is invalid.', 400);
  }
  if (timestamp.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS) {
    throw new AppError('LOCATION_TIMESTAMP_IN_FUTURE', 'GPS timestamp is ahead of the server clock.', 422);
  }
  if (now.getTime() - timestamp.getTime() > env.DRIVER_LOCATION_MAX_AGE_MS) {
    throw new AppError('LOCATION_FIX_TOO_OLD', 'GPS fix is too old. Refresh device location and retry.', 422);
  }
};
const validCoordinates = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
const haversineMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const part = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(part), Math.sqrt(Math.max(0, 1 - part)));
};
export const isPlausibleLocationJump = (previous: { latitude?: number; longitude?: number; timestamp?: Date; accuracy?: number }, next: LocationInput, now = new Date()) => {
  if (typeof previous.latitude !== 'number' || typeof previous.longitude !== 'number' || !(previous.timestamp instanceof Date)) return true;
  const elapsedMs = next.timestamp.getTime() - previous.timestamp.getTime();
  if (elapsedMs <= 0) return false;
  // A long gap means the driver may have moved while offline; stale locations are not used as a velocity baseline.
  if (now.getTime() - previous.timestamp.getTime() > env.DRIVER_LOCATION_STALE_AFTER_MS * 4) return true;
  const distance = haversineMeters(previous.latitude, previous.longitude, next.latitude, next.longitude);
  const uncertainty = Math.max(50, (previous.accuracy ?? 0) + next.accuracy);
  return distance <= MAX_LOCATION_SPEED_MPS * (elapsedMs / 1000) + uncertainty;
};

const operationalDriver = async (driverId: string, session?: import('mongoose').ClientSession) => {
  const driver = await AmbulanceDriverModel.findById(oid(driverId, 'driver')).session(session ?? null).lean().exec();
  if (!driver) throw new AppError('DRIVER_NOT_FOUND', 'Driver not found.', 404);
  if (driver.accountStatus !== 'ACTIVE') throw new AppError('DRIVER_NOT_ACTIVE', 'Driver account is not active.', 403);
  if (driver.licenseVerificationStatus !== 'VERIFIED') throw new AppError('DRIVER_NOT_VERIFIED', 'Driver license must be verified before duty.', 403);
  return driver;
};
const hasReservation = (resource: { dispatchReservationId?: Types.ObjectId; dispatchReservationExpiresAt?: Date }, now: Date) =>
  Boolean(resource.dispatchReservationId && (!resource.dispatchReservationExpiresAt || resource.dispatchReservationExpiresAt.getTime() > now.getTime()));
const activeTripForDriver = async (driverId: Types.ObjectId, session?: import('mongoose').ClientSession) =>
  TripModel.exists({ driverId, status: { $in: ACTIVE_TRIP_STATUSES } }).session(session ?? null).exec();
const activeTripForAmbulance = async (ambulanceId: Types.ObjectId, session?: import('mongoose').ClientSession) =>
  TripModel.exists({ ambulanceId, status: { $in: ACTIVE_TRIP_STATUSES } }).session(session ?? null).exec();
const providerEligible = async (providerId: Types.ObjectId, session: import('mongoose').ClientSession) => {
  const provider = await AmbulanceProviderModel.findOne({ _id: providerId, accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' }).session(session).select('_id').lean().exec();
  if (!provider) throw new AppError('PROVIDER_NOT_OPERATIONAL', 'The assigned ambulance provider is not active and verified.', 409);
};
const ensureNoReservation = (driver: AmbulanceDriverDocument | Record<string, unknown>, ambulance: AmbulanceDocument | Record<string, unknown>, now: Date) => {
  if (hasReservation(driver as AmbulanceDriverDocument, now) || hasReservation(ambulance as AmbulanceDocument, now)) {
    throw new AppError('DISPATCH_RESERVATION_ACTIVE', 'Resolve the active dispatch offer before changing duty.', 409);
  }
};
const applyLocation = async (ambulance: AmbulanceDocument & { _id: Types.ObjectId }, input: LocationInput, now: Date, session: import('mongoose').ClientSession) => {
  validateLocationTimestamp(input.timestamp, now);
  if (!validCoordinates(input.latitude, input.longitude)) throw new AppError('INVALID_COORDINATES', 'GPS coordinates are invalid.', 400);
  const previousTimestamp = ambulance.locationSourceTimestamp;
  if (previousTimestamp && input.timestamp.getTime() <= previousTimestamp.getTime()) {
    throw new AppError('LOCATION_TIMESTAMP_NOT_NEW', 'Duplicate or out-of-order GPS updates are rejected.', 409);
  }
  if (!isPlausibleLocationJump({
    latitude: ambulance.currentLatitude,
    longitude: ambulance.currentLongitude,
    timestamp: previousTimestamp,
    accuracy: ambulance.locationAccuracyMeters,
  }, input, now)) {
    throw new AppError('IMPLAUSIBLE_LOCATION_JUMP', 'GPS movement is implausible. Wait for a better fix and retry.', 422);
  }
  const updated = await AmbulanceModel.findOneAndUpdate({
    _id: ambulance._id,
    providerId: ambulance.providerId,
    verificationStatus: 'VERIFIED',
    accountStatus: 'ACTIVE',
    $or: [{ locationSourceTimestamp: { $exists: false } }, { locationSourceTimestamp: { $lt: input.timestamp } }],
  }, {
    $set: {
      currentLatitude: input.latitude,
      currentLongitude: input.longitude,
      location: { type: 'Point', coordinates: [input.longitude, input.latitude] },
      locationUpdatedAt: now,
      locationSourceTimestamp: input.timestamp,
      locationAccuracyMeters: input.accuracy,
    },
  }, { returnDocument: 'after', session, runValidators: true }).lean().exec();
  if (!updated) throw new AppError('LOCATION_TIMESTAMP_NOT_NEW', 'A newer GPS update was already saved. Refresh location and retry.', 409);
  return updated;
};

const publishDuty = (driverId: Types.ObjectId, ambulanceId: Types.ObjectId, data: Record<string, unknown>) => {
  const payload = { driverId: String(driverId), ambulanceId: String(ambulanceId), ...data };
  broadcastEvent(`driver:${driverId}`, 'driver:duty:update', payload);
  broadcastEvent(`ambulance:${ambulanceId}`, 'driver:duty:update', payload);
};

export const startDriverDuty = async (driverId: string, input: LocationInput) => {
  const did = oid(driverId, 'driver');
  validateLocationTimestamp(input.timestamp);
  if (!validCoordinates(input.latitude, input.longitude)) throw new AppError('INVALID_COORDINATES', 'GPS coordinates are invalid.', 400);
  const session = await startSession();
  let result: { driverId: string; ambulanceId: string; status: string; dutyState: string; locationUpdatedAt: Date } | null = null;
  try {
    await session.withTransaction(async () => {
      const driver = await operationalDriver(driverId, session);
      if (!driver.assignedAmbulanceId) throw new AppError('DRIVER_AMBULANCE_NOT_ASSIGNED', 'Assign an eligible ambulance before starting duty.', 409);
      if (driver.availabilityStatus !== 'OFFLINE') throw new AppError('DUTY_STATE_CONFLICT', 'Driver is already on duty or busy.', 409);
      if (await activeTripForDriver(did, session)) throw new AppError('DRIVER_ON_ACTIVE_TRIP', 'Duty cannot start while an active trip exists.', 409);
      const ambulance = await AmbulanceModel.findOne({
        _id: driver.assignedAmbulanceId, providerId: driver.providerId,
        accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED',
        currentStatus: { $in: ['OFFLINE', 'AVAILABLE'] },
      }).session(session).exec();
      if (!ambulance) throw new AppError('AMBULANCE_NOT_OPERATIONAL', 'Assigned ambulance must be active, verified, and not busy or in maintenance.', 409);
      await providerEligible(driver.providerId, session);
      const assigned = await AmbulanceDriverModel.findOne({ assignedAmbulanceId: ambulance._id, providerId: driver.providerId, _id: { $ne: did }, accountStatus: 'ACTIVE' }).session(session).select('_id').lean().exec();
      if (assigned) throw new AppError('AMBULANCE_DRIVER_MISMATCH', 'Another active driver is assigned to this ambulance.', 409);
      if (await activeTripForAmbulance(ambulance._id, session)) throw new AppError('AMBULANCE_ON_ACTIVE_TRIP', 'Assigned ambulance already has an active trip.', 409);
      ensureNoReservation(driver, ambulance, new Date());
      const now = new Date();
      const changedDriver = await AmbulanceDriverModel.findOneAndUpdate({
        _id: did, providerId: driver.providerId, assignedAmbulanceId: ambulance._id,
        accountStatus: 'ACTIVE', licenseVerificationStatus: 'VERIFIED', availabilityStatus: 'OFFLINE',
      }, { $set: { availabilityStatus: 'ONLINE' } }, { returnDocument: 'after', session }).lean().exec();
      if (!changedDriver) throw new AppError('DUTY_STATE_CONFLICT', 'Another duty change won the race. Refresh status and retry.', 409);
      const changedAmbulance = await AmbulanceModel.findOneAndUpdate({
        _id: ambulance._id, providerId: driver.providerId, accountStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED', currentStatus: { $in: ['OFFLINE', 'AVAILABLE'] },
        $or: [{ dispatchReservationId: { $exists: false } }, { dispatchReservationExpiresAt: { $lte: now } }],
      }, { $set: { currentStatus: 'AVAILABLE' } }, { returnDocument: 'after', session }).exec();
      if (!changedAmbulance) throw new AppError('AMBULANCE_STATE_CONFLICT', 'Assigned ambulance changed state. Refresh and retry.', 409);
      const located = await applyLocation(changedAmbulance, input, now, session);
      result = { driverId: String(did), ambulanceId: String(located._id), status: 'ONLINE', dutyState: 'AVAILABLE', locationUpdatedAt: located.locationUpdatedAt ?? now };
    });
  } finally {
    await session.endSession();
  }
  const completedResult = result as { driverId: string; ambulanceId: string; status: string; dutyState: string; locationUpdatedAt: Date } | null;
  if (!completedResult) throw new AppError('DUTY_START_FAILED', 'Duty could not be started. Retry after refreshing status.', 409);
  publishDuty(did, new Types.ObjectId(completedResult.ambulanceId), { status: completedResult.status, dutyState: completedResult.dutyState, locationUpdatedAt: completedResult.locationUpdatedAt, freshness: 'FRESH' });
  return { ...completedResult, trackingIntervalMs: env.DRIVER_LOCATION_UPDATE_INTERVAL_MS, staleAfterMs: env.DRIVER_LOCATION_STALE_AFTER_MS };
};

export const endDriverDuty = async (driverId: string) => {
  const did = oid(driverId, 'driver');
  const session = await startSession();
  let result: { ambulanceId?: Types.ObjectId; status: 'OFFLINE'; dutyState: 'OFF_DUTY'; alreadyOffDuty?: boolean } | null = null;
  try {
    await session.withTransaction(async () => {
      const driver = await AmbulanceDriverModel.findById(did).session(session).lean().exec();
      if (!driver) throw new AppError('DRIVER_NOT_FOUND', 'Driver not found.', 404);
      const driverTrip = await activeTripForDriver(did, session);
      if (driverTrip) {
        throw new AppError('DRIVER_ON_ACTIVE_TRIP', 'Complete or hand over the active trip before ending duty.', 409);
      }
      if (!driver.assignedAmbulanceId) {
        if (driver.availabilityStatus === 'OFFLINE') {
          result = { status: 'OFFLINE', dutyState: 'OFF_DUTY', alreadyOffDuty: true };
          return;
        }
        if (driver.availabilityStatus === 'ONLINE' || driver.availabilityStatus === 'BUSY') {
          const changed = await AmbulanceDriverModel.findOneAndUpdate({ _id: did, availabilityStatus: driver.availabilityStatus }, { $set: { availabilityStatus: 'OFFLINE' } }, { returnDocument: 'after', session }).lean().exec();
          if (!changed) throw new AppError('DUTY_STATE_CONFLICT', 'Another duty change won the race. Refresh and retry.', 409);
          result = { status: 'OFFLINE', dutyState: 'OFF_DUTY' };
          return;
        }
        throw new AppError('DRIVER_AMBULANCE_NOT_ASSIGNED', 'No assigned ambulance is available to end duty safely.', 409);
      }
      const ambulance = await AmbulanceModel.findOne({
        _id: driver.assignedAmbulanceId, providerId: driver.providerId,
      }).session(session).exec();
      if (!ambulance) {
        if (driver.availabilityStatus === 'OFFLINE') {
          result = { status: 'OFFLINE', dutyState: 'OFF_DUTY', alreadyOffDuty: true };
          return;
        }
        const changed = await AmbulanceDriverModel.findOneAndUpdate({ _id: did, availabilityStatus: { $in: ['ONLINE', 'BUSY'] } }, { $set: { availabilityStatus: 'OFFLINE' } }, { returnDocument: 'after', session }).lean().exec();
        if (!changed) throw new AppError('DUTY_STATE_CONFLICT', 'Assigned ambulance is missing and duty could not be reconciled.', 409);
        result = { status: 'OFFLINE', dutyState: 'OFF_DUTY' };
        return;
      }
      if (await activeTripForAmbulance(ambulance._id, session)) {
        throw new AppError('AMBULANCE_ON_ACTIVE_TRIP', 'Ambulance has an active trip.', 409);
      }
      ensureNoReservation(driver, ambulance, new Date());
      if (driver.availabilityStatus === 'OFFLINE') {
        if (ambulance.currentStatus === 'AVAILABLE') {
          const correctedAmbulance = await AmbulanceModel.findOneAndUpdate({
            _id: ambulance._id, providerId: driver.providerId, currentStatus: 'AVAILABLE',
            $or: [{ dispatchReservationId: { $exists: false } }, { dispatchReservationExpiresAt: { $lte: new Date() } }],
          }, { $set: { currentStatus: 'OFFLINE' } }, { returnDocument: 'after', session }).lean().exec();
          if (!correctedAmbulance) throw new AppError('AMBULANCE_STATE_CONFLICT', 'Ambulance state changed while reconciling off-duty status.', 409);
        } else if (ambulance.currentStatus === 'BUSY') {
          const correctedAmbulance = await AmbulanceModel.findOneAndUpdate({ _id: ambulance._id, providerId: driver.providerId, currentStatus: 'BUSY', $or: [{ dispatchReservationId: { $exists: false } }, { dispatchReservationExpiresAt: { $lte: new Date() } }] }, { $set: { currentStatus: 'OFFLINE' } }, { returnDocument: 'after', session }).lean().exec();
          if (!correctedAmbulance) throw new AppError('AMBULANCE_STATE_CONFLICT', 'Ambulance state changed while reconciling off-duty status.', 409);
        } else if (!['OFFLINE', 'MAINTENANCE'].includes(ambulance.currentStatus)) {
          throw new AppError('AMBULANCE_STATE_CONFLICT', 'Ambulance state is inconsistent with an off-duty driver; contact operations.', 409);
        }
        result = { ambulanceId: ambulance._id, status: 'OFFLINE', dutyState: 'OFF_DUTY', alreadyOffDuty: true };
        return;
      }
      if (!['ONLINE', 'BUSY'].includes(driver.availabilityStatus)) {
        throw new AppError('DUTY_STATE_CONFLICT', 'Driver duty state changed. Refresh status and retry.', 409);
      }
      if (!['AVAILABLE', 'OFFLINE', 'MAINTENANCE', 'BUSY'].includes(ambulance.currentStatus)) throw new AppError('AMBULANCE_STATE_CONFLICT', 'Ambulance is not in a safe state for duty termination; contact operations.', 409);
      const changedDriver = await AmbulanceDriverModel.findOneAndUpdate({
        _id: did, availabilityStatus: { $in: ['ONLINE', 'BUSY'] }, assignedAmbulanceId: ambulance._id, providerId: driver.providerId,
      }, { $set: { availabilityStatus: 'OFFLINE' } }, { returnDocument: 'after', session }).lean().exec();
      if (!changedDriver) throw new AppError('DUTY_STATE_CONFLICT', 'Another duty change won the race. Refresh status and retry.', 409);
      if (ambulance.currentStatus === 'AVAILABLE' || ambulance.currentStatus === 'BUSY') {
        const changedAmbulance = await AmbulanceModel.findOneAndUpdate({
          _id: ambulance._id, providerId: driver.providerId, currentStatus: ambulance.currentStatus,
          $or: [{ dispatchReservationId: { $exists: false } }, { dispatchReservationExpiresAt: { $lte: new Date() } }],
        }, { $set: { currentStatus: 'OFFLINE' } }, { returnDocument: 'after', session }).lean().exec();
        if (!changedAmbulance) throw new AppError('AMBULANCE_STATE_CONFLICT', 'Ambulance changed state while ending duty. Refresh and retry.', 409);
      }
      result = { ambulanceId: ambulance._id, status: 'OFFLINE', dutyState: 'OFF_DUTY' };
    });
  } finally {
    await session.endSession();
  }
  const completedResult = result as { ambulanceId?: Types.ObjectId; status: 'OFFLINE'; dutyState: 'OFF_DUTY'; alreadyOffDuty?: boolean } | null;
  if (!completedResult) throw new AppError('DUTY_END_FAILED', 'Duty could not be ended. Retry after refreshing status.', 409);
  if (completedResult.ambulanceId) publishDuty(did, completedResult.ambulanceId, { status: completedResult.status, dutyState: completedResult.dutyState, freshness: 'STALE' });
  return { status: completedResult.status, dutyState: completedResult.dutyState, alreadyOffDuty: Boolean(completedResult.alreadyOffDuty), updatedAt: new Date() };
};

export const updateDriverLocation = async (driverId: string, input: LocationInput) => {
  const did = oid(driverId, 'driver');
  validateLocationTimestamp(input.timestamp);
  if (!validCoordinates(input.latitude, input.longitude)) throw new AppError('INVALID_COORDINATES', 'GPS coordinates are invalid.', 400);
  const session = await startSession();
  let telemetry: Record<string, unknown> | null = null;
  let ambulanceId: Types.ObjectId | null = null;
  try {
    await session.withTransaction(async () => {
      const driver = await operationalDriver(driverId, session);
      if (!driver.assignedAmbulanceId) throw new AppError('DRIVER_AMBULANCE_NOT_ASSIGNED', 'Driver has no assigned ambulance.', 409);
      if (!['ONLINE', 'BUSY'].includes(driver.availabilityStatus)) throw new AppError('DRIVER_OFFLINE', 'Location updates require active duty.', 409);
      const activeTrip = await TripModel.findOne({ driverId: did, status: { $in: ACTIVE_TRIP_STATUSES } }).select('_id ambulanceId').session(session).lean().exec();
      if (driver.availabilityStatus === 'BUSY' && !activeTrip) throw new AppError('DRIVER_BUSY_WITHOUT_TRIP', 'Driver is marked BUSY without an active trip; contact operations.', 409);
      if (activeTrip && driver.availabilityStatus !== 'BUSY') throw new AppError('DRIVER_TRIP_STATE_MISMATCH', 'An active trip exists but driver availability is not BUSY. Contact operations before tracking resumes.', 409);
      if (activeTrip && String(activeTrip.ambulanceId) !== String(driver.assignedAmbulanceId)) throw new AppError('DRIVER_AMBULANCE_MISMATCH', 'Active trip ambulance does not match the driver assignment.', 409);
      const ambulance = await AmbulanceModel.findOne({
        _id: driver.assignedAmbulanceId, providerId: driver.providerId,
        accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED',
        currentStatus: driver.availabilityStatus === 'BUSY' ? 'BUSY' : 'AVAILABLE',
      }).session(session).exec();
      if (!ambulance) throw new AppError('AMBULANCE_NOT_OPERATIONAL', 'Assigned ambulance state no longer matches the driver duty state.', 409);
      await providerEligible(driver.providerId, session);
      const now = new Date();
      const located = await applyLocation(ambulance, input, now, session);
      ambulanceId = located._id;
      telemetry = {
        ambulanceId: String(located._id), driverId: String(did),
        latitude: located.currentLatitude, longitude: located.currentLongitude,
        accuracyMeters: located.locationAccuracyMeters,
        locationUpdatedAt: located.locationUpdatedAt,
        sourceTimestamp: located.locationSourceTimestamp,
        freshness: 'FRESH', coordinatesAreLive: true,
        dutyState: driverDutyStateForAvailability(driver.availabilityStatus),
      };
    });
  } finally {
    await session.endSession();
  }
  const completedTelemetry = telemetry as Record<string, unknown> | null;
  const completedAmbulanceId = ambulanceId as Types.ObjectId | null;
  if (!completedTelemetry || !completedAmbulanceId) throw new AppError('LOCATION_UPDATE_FAILED', 'Location update was not saved. Retry.', 409);
  // Keep existing SSE events intact while publishing a minimal location payload to the authorized trip participants.
  broadcastEvent(`driver:${did}`, 'tracking:location:update', completedTelemetry);
  broadcastEvent(`ambulance:${completedAmbulanceId}`, 'tracking:location:update', completedTelemetry);
  const activeTrip = await TripModel.findOne({ driverId: did, ambulanceId: completedAmbulanceId, status: { $in: ACTIVE_TRIP_STATUSES } })
    .select('_id emergencyRequestId destinationHospitalId status').sort({ createdAt: -1 }).lean().exec();
  if (activeTrip) {
    const locationEvent = {
      emergencyRequestId: String(activeTrip.emergencyRequestId), tripId: String(activeTrip._id),
      tripStatus: activeTrip.status, ambulanceId: String(completedAmbulanceId),
      latitude: completedTelemetry.latitude, longitude: completedTelemetry.longitude,
      accuracyMeters: completedTelemetry.accuracyMeters, locationUpdatedAt: completedTelemetry.locationUpdatedAt,
      sourceTimestamp: completedTelemetry.sourceTimestamp, freshness: 'FRESH', coordinatesAreLive: true,
    };
    broadcastEvent(`emergency:${activeTrip.emergencyRequestId}`, 'tracking:location', locationEvent);
    broadcastEvent(`trip:${activeTrip._id}`, 'tracking:location', locationEvent);
    // Hospital viewers subscribe to the authorized emergency room for per-trip GPS; the hospital-operations room carries coordination/status events, avoiding duplicate location delivery.
  }
  return completedTelemetry;
};

export const getDriverDutyStatus = async (driverId: string) => {
  const did = oid(driverId, 'driver');
  const driver = await AmbulanceDriverModel.findById(did).lean().exec();
  if (!driver) throw new AppError('DRIVER_NOT_FOUND', 'Driver not found.', 404);
  const ambulance = driver.assignedAmbulanceId
    ? await AmbulanceModel.findOne({ _id: driver.assignedAmbulanceId, providerId: driver.providerId }).select('registrationNumber vehicleNumber ambulanceType currentStatus accountStatus verificationStatus currentLatitude currentLongitude locationUpdatedAt locationSourceTimestamp locationAccuracyMeters dispatchReservationId dispatchReservationExpiresAt').lean().exec()
    : null;
  const provider = await AmbulanceProviderModel.findById(driver.providerId).select('accountStatus verificationStatus').lean().exec();
  const now = new Date();
  const freshness = ['ONLINE', 'BUSY'].includes(driver.availabilityStatus) ? locationFreshnessFor(ambulance?.locationUpdatedAt, now) : 'STALE';
  const activeTrip = await TripModel.findOne({ driverId: did, status: { $in: ACTIVE_TRIP_STATUSES } }).select('_id status emergencyRequestId ambulanceId').sort({ createdAt: -1 }).lean().exec();
  const activeDispatchOffer = await DispatchJobModel.exists({ currentDriverId: did, status: 'OFFERED', deadlineAt: { $gt: now } });
  const activeAmbulanceTrip = ambulance ? await TripModel.exists({ ambulanceId: ambulance._id, status: { $in: ACTIVE_TRIP_STATUSES } }) : null;
  return {
    status: driver.availabilityStatus,
    dutyState: driverDutyStateForAvailability(driver.availabilityStatus),
    updatedAt: driver.updatedAt,
    accountStatus: driver.accountStatus,
    licenseVerificationStatus: driver.licenseVerificationStatus,
    providerStatus: provider ? { accountStatus: provider.accountStatus, verificationStatus: provider.verificationStatus } : null,
    assignedAmbulance: ambulance ? {
      id: String(ambulance._id), registrationNumber: ambulance.registrationNumber, vehicleNumber: ambulance.vehicleNumber,
      ambulanceType: ambulance.ambulanceType, status: ambulance.currentStatus,
      accountStatus: ambulance.accountStatus, verificationStatus: ambulance.verificationStatus,
    } : null,
    location: ambulance && typeof ambulance.currentLatitude === 'number' && typeof ambulance.currentLongitude === 'number' ? {
      latitude: ambulance.currentLatitude, longitude: ambulance.currentLongitude,
      accuracyMeters: ambulance.locationAccuracyMeters,
      updatedAt: ambulance.locationUpdatedAt,
      freshness,
      coordinatesAreLive: freshness === 'FRESH' && ['ONLINE', 'BUSY'].includes(driver.availabilityStatus),
    } : null,
    activeTrip: activeTrip ? { id: String(activeTrip._id), status: activeTrip.status, emergencyRequestId: String(activeTrip.emergencyRequestId), ambulanceId: String(activeTrip.ambulanceId) } : null,
    hasActiveDispatchOffer: Boolean(activeDispatchOffer),
    trackingIntervalMs: env.DRIVER_LOCATION_UPDATE_INTERVAL_MS,
    staleAfterMs: env.DRIVER_LOCATION_STALE_AFTER_MS,
    canStartDuty: driver.accountStatus === 'ACTIVE' && driver.licenseVerificationStatus === 'VERIFIED' &&
      provider?.accountStatus === 'ACTIVE' && provider.verificationStatus === 'VERIFIED' &&
      driver.availabilityStatus === 'OFFLINE' && !activeTrip && !activeAmbulanceTrip && !activeDispatchOffer &&
      !hasReservation(driver, now) && Boolean(ambulance && ambulance.accountStatus === 'ACTIVE' && ambulance.verificationStatus === 'VERIFIED' && ['OFFLINE', 'AVAILABLE'].includes(ambulance.currentStatus) && !hasReservation(ambulance, now)),
    canEndDuty: ['ONLINE', 'BUSY'].includes(driver.availabilityStatus) && !activeTrip && !activeAmbulanceTrip && !activeDispatchOffer && !hasReservation(driver, now) && Boolean(!ambulance || !hasReservation(ambulance, now)),
  };
};

export const updateDriverStatus = async (driverId: string, status: 'ONLINE' | 'OFFLINE' | 'BUSY') => {
  if (status === 'ONLINE') throw new AppError('GPS_REQUIRED_TO_START_DUTY', 'Start duty with a fresh browser GPS fix using POST /ambulance-driver/duty/start.', 409);
  if (status === 'OFFLINE') return endDriverDuty(driverId);
  const did = oid(driverId, 'driver');
  const driver = await operationalDriver(driverId);
  const activeTrip = await activeTripForDriver(did);
  if (!activeTrip) throw new AppError('INVALID_DRIVER_STATUS', 'Driver cannot be BUSY without an active trip.', 409);
  if (driver.availabilityStatus !== 'BUSY') throw new AppError('TRIP_STATE_AUTHORITATIVE', 'Trip lifecycle controls BUSY state; it cannot be changed manually.', 409);
  return getDriverDutyStatus(driverId);
};
