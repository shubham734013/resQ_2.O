import { Types, startSession } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { HospitalModel } from '../models/Hospital.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { TripModel } from '../models/Trip.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { broadcastEvent } from './realtimeService.js';
import { AppError } from '../utils/AppError.js';
import { calculateGoogleRoutes } from './mapsService.js';
import type { z } from 'zod';
import type { createEmergencyRequestSchema, emergencyDiscoveryQuerySchema } from '../schemas/emergency.js';
import type { EmergencyRequestDocument, HospitalEmergencyStatus } from '../models/EmergencyRequest.js';

type CreateEmergencyInput = z.infer<typeof createEmergencyRequestSchema>;
type EmergencyDiscoveryQuery = z.infer<typeof emergencyDiscoveryQuerySchema>;
export type EmergencyRecord = EmergencyRequestDocument & { _id: Types.ObjectId | string };

export const USER_CANCELLABLE_STATUSES: HospitalEmergencyStatus[] = ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'];
export const EMERGENCY_ACTIVE_TRIP_STATUSES = ['ASSIGNED', 'ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'] as const;
export const EMERGENCY_MATERIAL_TRANSPORT_STATUSES = ['TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'] as const;

const assertId = (value: string, name: string) => {
  if (!Types.ObjectId.isValid(value)) throw new AppError('INVALID_ID', `Invalid ${name}`, 400);
  return new Types.ObjectId(value);
};

const output = (request: EmergencyRecord) => ({
  id: String(request._id),
  requestCode: request.requestCode,
  hospitalId: String(request.hospitalId),
  situationType: request.situationType,
  reportedAt: request.reportedAt,
  location: request.location,
  latitude: request.latitude,
  longitude: request.longitude,
  status: request.status,
  statusHistory: request.statusHistory.map((entry) => ({
    status: entry.status,
    changedAt: entry.changedAt,
    actorId: entry.actorId ? String(entry.actorId) : undefined,
    actorRole: entry.actorRole,
    previousStatus: entry.previousStatus,
  })),
  ambulanceId: request.ambulanceId ? String(request.ambulanceId) : undefined,
  ambulanceProviderId: request.ambulanceProviderId ? String(request.ambulanceProviderId) : undefined,
  driverId: request.driverId ? String(request.driverId) : undefined,
  patientId: request.patientId ? String(request.patientId) : undefined,
  etaMinutes: request.etaMinutes,
  routeDistanceMeters: request.routeDistanceMeters,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

type EmergencyHospitalCandidate = {
  _id: Types.ObjectId;
  name: string;
  hospitalType: string;
  services?: string[];
  capabilities?: string[];
  emergencyAvailability: string;
  verificationStatus: string;
  accountStatus: string;
  updatedAt: Date;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  location?: { type?: string; coordinates?: number[] };
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
};

const situationTerms: Record<string, RegExp> = {
  accident_injury: /trauma|accident|emergency|critical|orthop|surg|icu/i,
  severe_bleeding: /trauma|bleed|emergency|critical|surg|icu/i,
  breathing_difficulty: /respirat|pulmon|emergency|critical|icu/i,
  chest_pain: /cardio|heart|stemi|cath|emergency|critical|icu/i,
  stroke_symptoms: /stroke|neuro|brain|emergency|critical|icu/i,
  unconscious_person: /emergency|critical|icu|neuro|trauma/i,
  burn: /burn|trauma|emergency|critical|surg|icu/i,
  other: /emergency|critical|urgent|icu/i,
};
const situationIdForLabel: Record<string, string> = {
  'Accident / Injury': 'accident_injury',
  'Severe Bleeding': 'severe_bleeding',
  'Breathing Difficulty': 'breathing_difficulty',
  'Chest Pain': 'chest_pain',
  'Stroke-like Symptoms': 'stroke_symptoms',
  'Unconscious Person': 'unconscious_person',
  Burn: 'burn',
  'Other Acute Situation': 'other',
};
const hospitalCoordinate = (hospital: Pick<EmergencyHospitalCandidate, 'location' | 'latitude' | 'longitude'>) => {
  const coordinates = hospital.location?.coordinates;
  const geoLatitude = Array.isArray(coordinates) ? coordinates[1] : undefined;
  const geoLongitude = Array.isArray(coordinates) ? coordinates[0] : undefined;
  const latitude = typeof geoLatitude === 'number' && Number.isFinite(geoLatitude) && geoLatitude >= -90 && geoLatitude <= 90
    ? geoLatitude
    : hospital.latitude;
  const longitude = typeof geoLongitude === 'number' && Number.isFinite(geoLongitude) && geoLongitude >= -180 && geoLongitude <= 180
    ? geoLongitude
    : hospital.longitude;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
};
export const categoryIdForSituation = (situationType: string) => {
  const known = situationIdForLabel[situationType] ?? situationType;
  if (situationTerms[known]) return known;
  const text = situationType.toLowerCase();
  if (/chest|cardiac|heart|cardio/.test(text)) return 'chest_pain';
  if (/stroke|neurolog|neuro|brain|speech difficulty/.test(text)) return 'stroke_symptoms';
  if (/breath|respirat|asthma|chok/.test(text)) return 'breathing_difficulty';
  if (/bleed|hemorrhag/.test(text)) return 'severe_bleeding';
  if (/burn/.test(text)) return 'burn';
  if (/accident|injur|trauma|fracture/.test(text)) return 'accident_injury';
  if (/unconscious|unresponsive|faint/.test(text)) return 'unconscious_person';
  return 'other';
};
export const hospitalMatchesSituation = (hospital: Pick<EmergencyHospitalCandidate, 'hospitalType' | 'services' | 'capabilities'>, situationType: string) => {
  const terms = situationTerms[categoryIdForSituation(situationType)] ?? /emergency|critical|urgent|icu/i;
  return [hospital.hospitalType, ...(hospital.services ?? []), ...(hospital.capabilities ?? [])].some((value) => terms.test(value));
};
const haversineMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const part = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(part), Math.sqrt(Math.max(0, 1 - part)));
};
const safeRoute = async (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => {
  try {
    const result = await calculateGoogleRoutes({ origin, destination, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE' });
    const route = result.routes[0];
    if (!route || !Number.isFinite(route.distanceMeters) || !Number.isFinite(route.durationSeconds) || route.durationSeconds <= 0) return null;
    return { distanceMeters: route.distanceMeters, etaMinutes: Math.max(1, Math.round(route.durationSeconds / 60)) };
  } catch {
    // Routing is best-effort: the request can still be persisted, but no fabricated ETA is returned.
    return null;
  }
};

export const discoverEmergencyHospitals = async (userId: string, query: EmergencyDiscoveryQuery) => {
  assertId(userId, 'user');
  const terms = situationTerms[query.category] ?? situationTerms.other;
  const filter = {
    accountStatus: 'ACTIVE' as const,
    verificationStatus: 'VERIFIED' as const,
    emergencyAvailability: { $in: ['AVAILABLE', 'LIMITED'] as const },
    $or: [{ hospitalType: terms }, { services: terms }, { capabilities: terms }],
  };
  const origin = { latitude: query.latitude, longitude: query.longitude };
  const geoItems = await HospitalModel.aggregate<EmergencyHospitalCandidate>([
    { $geoNear: { near: { type: 'Point', coordinates: [query.longitude, query.latitude] }, key: 'location', distanceField: 'distanceMeters', spherical: true, maxDistance: query.radiusMeters, query: filter } },
    { $limit: 100 },
    { $project: { name: 1, hospitalType: 1, services: 1, capabilities: 1, address: 1, city: 1, state: 1, country: 1, phone: 1, location: 1, latitude: 1, longitude: 1, verificationStatus: 1, accountStatus: 1, emergencyAvailability: 1, updatedAt: 1, distanceMeters: 1 } },
  ]).exec();

  // Older records may have valid legacy lat/lng without GeoJSON. Include them without writing/migrating data.
  const legacyItems = await HospitalModel.find({
    ...filter,
    location: { $exists: false },
    latitude: { $gte: -90, $lte: 90 },
    longitude: { $gte: -180, $lte: 180 },
  }).select('name hospitalType services capabilities address city state country phone latitude longitude verificationStatus accountStatus emergencyAvailability updatedAt').limit(500).lean().exec() as unknown as EmergencyHospitalCandidate[];
  const byId = new Map<string, { hospital: EmergencyHospitalCandidate; straightLineDistanceMeters: number }>();
  for (const hospital of geoItems) {
    const coordinates = hospitalCoordinate(hospital);
    if (!coordinates) continue;
    const distance = typeof hospital.distanceMeters === 'number' ? hospital.distanceMeters : haversineMeters(origin, coordinates);
    if (distance <= query.radiusMeters) byId.set(String(hospital._id), { hospital, straightLineDistanceMeters: distance });
  }
  for (const hospital of legacyItems) {
    const coordinates = hospitalCoordinate(hospital);
    if (!coordinates) continue;
    const distance = haversineMeters(origin, coordinates);
    if (distance <= query.radiusMeters && !byId.has(String(hospital._id))) byId.set(String(hospital._id), { hospital, straightLineDistanceMeters: distance });
  }
  const ranked = [...byId.values()].sort((a, b) => a.straightLineDistanceMeters - b.straightLineDistanceMeters).slice(0, query.limit);
  const items = await Promise.all(ranked.map(async ({ hospital, straightLineDistanceMeters }) => {
    const destination = hospitalCoordinate(hospital);
    const route = destination && query.includeRoutes ? await safeRoute(origin, destination) : null;
    return {
      id: String(hospital._id),
      name: hospital.name,
      type: hospital.hospitalType,
      services: hospital.services ?? [],
      capabilities: hospital.capabilities ?? [],
      address: hospital.address ?? '',
      city: hospital.city ?? '',
      state: hospital.state ?? '',
      country: hospital.country ?? '',
      phone: hospital.phone ?? '',
      latitude: destination?.latitude,
      longitude: destination?.longitude,
      distanceMeters: route?.distanceMeters ?? Math.round(straightLineDistanceMeters),
      straightLineDistanceMeters: Math.round(straightLineDistanceMeters),
      distanceType: route ? 'DRIVING' as const : 'STRAIGHT_LINE' as const,
      etaMinutes: route?.etaMinutes ?? null,
      estimatedTime: route ? route.etaMinutes + ' min' : null,
      emergencyAvailability: hospital.emergencyAvailability,
      verified: hospital.verificationStatus === 'VERIFIED',
      lastUpdated: hospital.updatedAt.toISOString(),
    };
  }));
  return { items, pagination: { page: 1, limit: query.limit, total: byId.size, totalPages: byId.size ? 1 : 0 }, searchedAt: new Date().toISOString() };
};

export const createEmergencyRequest = async (userId: string, input: CreateEmergencyInput, idempotencyKey: string) => {
  const userObjectId = assertId(userId, 'user');
  const hospitalId = assertId(input.hospitalId, 'hospital');
  const existing = await EmergencyRequestModel.findOne({ userId: userObjectId, idempotencyKey }).lean().exec();
  if (existing) {
    if (String(existing.hospitalId) !== String(hospitalId) || existing.situationType !== input.situationType ||
        existing.latitude !== input.latitude || existing.longitude !== input.longitude) {
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 'This submission key was already used for a different SOS payload. Refresh the request and try again.', 409);
    }
    return output(existing as EmergencyRecord);
  }

  const hospital = await HospitalModel.findOne({
    _id: hospitalId,
    accountStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    emergencyAvailability: { $in: ['AVAILABLE', 'LIMITED'] },
  }).select('_id name hospitalType services capabilities emergencyAvailability location latitude longitude').lean().exec() as unknown as EmergencyHospitalCandidate | null;
  if (!hospital) {
    throw new AppError('HOSPITAL_NOT_OPERATIONAL', 'The selected hospital is not currently eligible for emergency coordination. Refresh the hospital list or choose another destination.', 409);
  }
  if (!hospitalMatchesSituation(hospital, input.situationType)) {
    throw new AppError('HOSPITAL_CAPABILITY_MISMATCH', 'The selected hospital does not declare a capability matching this emergency type. Choose a different verified hospital.', 409);
  }
  const destination = hospitalCoordinate(hospital);
  if (!destination) {
    throw new AppError('HOSPITAL_LOCATION_UNAVAILABLE', 'The selected hospital has no valid coordinates. Choose another destination or call 112.', 409);
  }

  const route = await safeRoute({ latitude: input.latitude, longitude: input.longitude }, destination);
  const now = new Date();
  const session = await startSession();
  let linked: EmergencyRecord | null = null;
  try {
    await session.withTransaction(async () => {
      const currentHospital = await HospitalModel.findOne({
        _id: hospitalId,
        accountStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        emergencyAvailability: { $in: ['AVAILABLE', 'LIMITED'] },
      }).select('_id hospitalType services capabilities location latitude longitude').session(session).lean().exec() as unknown as EmergencyHospitalCandidate | null;
      if (!currentHospital || !hospitalMatchesSituation(currentHospital, input.situationType) || !hospitalCoordinate(currentHospital)) {
        throw new AppError('HOSPITAL_NO_LONGER_ELIGIBLE', 'Hospital eligibility changed before the request was saved. Refresh hospitals and choose an eligible destination.', 409);
      }
      const request = new EmergencyRequestModel({
        requestCode: 'RSQ-' + cryptoSafeCode(),
        idempotencyKey,
        userId: userObjectId,
        hospitalId,
        situationType: input.situationType,
        reportedAt: now,
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        etaMinutes: route?.etaMinutes,
        routeDistanceMeters: route?.distanceMeters,
        status: 'RECEIVED',
        statusHistory: [{ status: 'RECEIVED', changedAt: now, actorId: userObjectId, actorRole: 'USER' }],
      });
      await request.save({ session });
      const patient = await HospitalPatientModel.findOneAndUpdate(
        { emergencyId: request._id },
        { $setOnInsert: { caseId: 'CASE-' + cryptoSafeCode(), hospitalId, emergencyId: request._id, emergencyType: input.situationType, coordinationStatus: 'INCOMING', receivedAt: now } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session },
      ).exec();
      if (!patient) throw new AppError('EMERGENCY_LINK_FAILED', 'Emergency request could not be linked to the hospital case', 500);
      const updated = await EmergencyRequestModel.findOneAndUpdate(
        { _id: request._id, status: 'RECEIVED', patientId: { $exists: false } },
        { $set: { patientId: patient._id } },
        { new: true, runValidators: true, session },
      ).lean().exec();
      if (!updated) throw new AppError('EMERGENCY_LINK_FAILED', 'Emergency request could not be linked to the hospital case', 500);
      linked = updated as unknown as EmergencyRecord;
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      const duplicate = await EmergencyRequestModel.findOne({ userId: userObjectId, idempotencyKey }).lean().exec();
      if (duplicate) {
        if (String(duplicate.hospitalId) !== String(hospitalId) || duplicate.situationType !== input.situationType ||
            duplicate.latitude !== input.latitude || duplicate.longitude !== input.longitude) {
          throw new AppError('IDEMPOTENCY_KEY_REUSED', 'This submission key was already used for a different SOS payload. Refresh the request and try again.', 409);
        }
        return output(duplicate as EmergencyRecord);
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!linked) throw new AppError('EMERGENCY_CREATE_FAILED', 'Emergency request was not persisted. Retry safely or call 112.', 500);
  const out = output(linked);
  broadcastEvent(`hospital:${hospitalId}`, 'hospital:incoming-patient', out);
  broadcastEvent('operations', 'emergency:created', out);
  return out;
};

const cryptoSafeCode = () => randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();

export const listUserEmergencyRequests = async (
  userId: string,
  query: { page: number; limit: number; status?: HospitalEmergencyStatus; from?: Date; to?: Date; search?: string; sortOrder: 'asc' | 'desc' },
) => {
  const userObjectId = assertId(userId, 'user');
  const filter: Record<string, unknown> = { userId: userObjectId };
  if (query.status) filter.status = query.status;
  if (query.from || query.to) filter.reportedAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  if (query.search) filter.$or = [
    { requestCode: new RegExp(escapeRegex(query.search), 'i') },
    { situationType: new RegExp(escapeRegex(query.search), 'i') },
  ];

  const [items, total] = await Promise.all([
    EmergencyRequestModel.find(filter)
      .sort({ reportedAt: query.sortOrder === 'asc' ? 1 : -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    EmergencyRequestModel.countDocuments(filter).exec(),
  ]);

  return {
    items: items.map(output),
    pagination: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) },
  };
};

export const getUserEmergencyRequest = async (userId: string, emergencyId: string) => {
  const userObjectId = assertId(userId, 'user');
  const requestId = assertId(emergencyId, 'emergency');
  const request = await EmergencyRequestModel.findOne({ _id: requestId, userId: userObjectId }).lean().exec();
  if (!request) throw new AppError('NOT_FOUND', 'Emergency request not found', 404);
  return output(request);
};

export const cancelUserEmergencyRequest = async (userId: string, emergencyId: string) => {
  const userObjectId = assertId(userId, 'user');
  const requestId = assertId(emergencyId, 'emergency');
  const current = await EmergencyRequestModel.findOne({ _id: requestId, userId: userObjectId }).lean().exec();
  if (!current) throw new AppError('NOT_FOUND', 'Emergency request not found', 404);
  if (!USER_CANCELLABLE_STATUSES.includes(current.status)) {
    throw new AppError('EMERGENCY_NOT_CANCELLABLE', 'This emergency is no longer eligible for user cancellation', 409);
  }

  const session = await startSession();
  let updatedRequest: EmergencyRecord | null = null;
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const activeTrip = await TripModel.findOne({
        emergencyRequestId: requestId,
        status: { $in: EMERGENCY_ACTIVE_TRIP_STATUSES },
      }).session(session).lean().exec();

      if (activeTrip && (EMERGENCY_MATERIAL_TRANSPORT_STATUSES as readonly string[]).includes(activeTrip.status)) {
        throw new AppError('TRANSPORT_ALREADY_STARTED', 'Cancellation is not allowed after patient transport has started', 409);
      }

      const updated = await EmergencyRequestModel.findOneAndUpdate(
        { _id: requestId, userId: userObjectId, status: current.status },
        {
          $set: { status: 'CANCELLED' },
          $push: {
            statusHistory: {
              status: 'CANCELLED',
              changedAt: now,
              actorId: userObjectId,
              actorRole: 'USER',
              previousStatus: current.status,
            },
          },
        },
        { new: true, runValidators: true, session },
      ).lean().exec();
      if (!updated) throw new AppError('STALE_EMERGENCY_UPDATE', 'Emergency request changed before cancellation could be applied', 409);

      if (activeTrip) {
        const cancelledTrip = await TripModel.findOneAndUpdate(
          { _id: activeTrip._id, status: { $in: ['ASSIGNED', 'ACCEPTED'] } },
          {
            $set: { status: 'CANCELLED' },
            $push: {
              statusHistory: {
                status: 'CANCELLED',
                changedAt: now,
                actorId: userObjectId,
                actorRole: 'USER',
                previousStatus: activeTrip.status,
              },
            },
          },
          { new: true, runValidators: true, session },
        ).lean().exec();
        if (!cancelledTrip) throw new AppError('TRIP_STATE_CONFLICT', 'Trip changed before cancellation could be applied', 409);

        const ambulance = await AmbulanceModel.findOneAndUpdate(
          { _id: activeTrip.ambulanceId, currentStatus: 'BUSY' },
          { $set: { currentStatus: 'AVAILABLE' } },
          { new: true, session },
        ).lean().exec();
        if (!ambulance) throw new AppError('AMBULANCE_STATE_CONFLICT', 'Ambulance state could not be released safely', 409);

        if (activeTrip.driverId) {
          const driver = await AmbulanceDriverModel.findOneAndUpdate(
            { _id: activeTrip.driverId, availabilityStatus: 'BUSY' },
            { $set: { availabilityStatus: 'ONLINE' } },
            { new: true, session },
          ).lean().exec();
          if (!driver) throw new AppError('DRIVER_STATE_CONFLICT', 'Driver state could not be released safely', 409);
        }
      } else if (current.ambulanceId) {
        const ambulance = await AmbulanceModel.findOneAndUpdate(
          { _id: current.ambulanceId, currentStatus: 'BUSY' },
          { $set: { currentStatus: 'AVAILABLE' } },
          { new: true, session },
        ).lean().exec();
        if (!ambulance) throw new AppError('AMBULANCE_STATE_CONFLICT', 'Ambulance state could not be released safely', 409);
        if (current.driverId) {
          const driver = await AmbulanceDriverModel.findOneAndUpdate(
            { _id: current.driverId, availabilityStatus: 'BUSY' },
            { $set: { availabilityStatus: 'ONLINE' } },
            { new: true, session },
          ).lean().exec();
          if (!driver) throw new AppError('DRIVER_STATE_CONFLICT', 'Driver state could not be released safely', 409);
        }
      }

      const patient = await HospitalPatientModel.findOneAndUpdate(
        { emergencyId: requestId, coordinationStatus: { $nin: ['RESOLVED', 'CANCELLED'] } },
        { $set: { coordinationStatus: 'CANCELLED' }, $unset: { ambulanceId: 1, etaMinutes: 1 } },
        { new: true, session },
      ).lean().exec();
      if (!patient) throw new AppError('PATIENT_CASE_CONFLICT', 'Hospital patient case could not be cancelled safely', 409);

      updatedRequest = updated;
    });
  } finally {
    await session.endSession();
  }

  if (!updatedRequest) throw new AppError('EMERGENCY_CANCEL_FAILED', 'Emergency cancellation did not complete', 500);
  const out = output(updatedRequest);
  broadcastEvent(`hospital:${current.hospitalId}`, 'hospital:incoming-patient', out);
  broadcastEvent(`emergency:${emergencyId}`, 'tracking:status', out);
  broadcastEvent('operations', 'emergency:cancelled', out);
  return out;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
