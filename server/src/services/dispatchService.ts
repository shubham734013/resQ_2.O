import { randomUUID } from 'node:crypto';
import { startSession, Types, type QueryFilter } from 'mongoose';
import { DispatchJobModel, type DispatchJobDocument, type DispatchJobStatus, type DispatchAttemptDocument, type DispatchAttemptStatus } from '../models/DispatchJob.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel, type AmbulanceDocument } from '../models/Ambulance.js';
import { AmbulanceDriverModel, type AmbulanceDriverDocument } from '../models/AmbulanceDriver.js';
import { HospitalModel } from '../models/Hospital.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { calculateGoogleRoutes } from './mapsService.js';
import { AppError } from '../utils/AppError.js';

export const DISPATCH_ALLOWED_TRANSITIONS = {
  PENDING: ['SEARCHING', 'CANCELLED'],
  SEARCHING: ['OFFERED', 'EXHAUSTED', 'PENDING', 'CANCELLED'],
  OFFERED: ['PENDING', 'ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['CANCELLED'],
  EXHAUSTED: ['PENDING', 'ESCALATED', 'CANCELLED'],
  CANCELLED: [],
  ESCALATED: ['PENDING', 'CANCELLED'],
} as const;
export const isAllowedDispatchTransition = (from: keyof typeof DISPATCH_ALLOWED_TRANSITIONS, to: string) =>
  (DISPATCH_ALLOWED_TRANSITIONS[from] as readonly string[]).includes(to);

export const DISPATCH_OFFER_TIMEOUT_MS = 25_000;
export const DISPATCH_LOCATION_FRESHNESS_MS = 90_000;
export const DISPATCH_SEARCH_RADIUS_METERS = 100_000;
export const DISPATCH_ROUTE_CANDIDATE_LIMIT = 30;
export const DISPATCH_ACTIVE_TRIP_STATUSES = ['ASSIGNED', 'ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'] as const;
const LEASE_MS = 30_000;
const DRIVER_LOCATION_MAX_FUTURE_SKEW_MS = 5_000;

type Coordinates = { latitude: number; longitude: number };
type RouteRank = { source: 'DRIVING' | 'STRAIGHT_LINE_FALLBACK'; distanceMeters: number; etaSeconds?: number };
export type DispatchCandidate = {
  providerId: Types.ObjectId;
  ambulanceId: Types.ObjectId;
  driverId: Types.ObjectId;
  coordinates: Coordinates;
  straightLineMeters: number;
  route: RouteRank;
};
type DispatchJobLean = DispatchJobDocument & { _id: Types.ObjectId };
const id = (value: string, label: string) => {
  if (!Types.ObjectId.isValid(value)) throw new AppError('INVALID_ID', `Invalid ${label}`, 400);
  return new Types.ObjectId(value);
};
const validCoordinates = (latitude: unknown, longitude: unknown): Coordinates | null => {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
};
const ambulanceCoordinates = (ambulance: {
  location?: { coordinates?: number[] };
  currentLatitude?: number;
  currentLongitude?: number;
}): Coordinates | null => {
  const coordinates = ambulance.location?.coordinates;
  const geo = Array.isArray(coordinates) && coordinates.length >= 2
    ? validCoordinates(coordinates[1], coordinates[0])
    : null;
  return geo ?? validCoordinates(ambulance.currentLatitude, ambulance.currentLongitude);
};
const haversineMeters = (a: Coordinates, b: Coordinates) => {
  const radians = (n: number) => n * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const part = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(part), Math.sqrt(Math.max(0, 1 - part)));
};
const routeRank = async (origin: Coordinates, destination: Coordinates, straightLineMeters: number): Promise<RouteRank> => {
  try {
    const result = await calculateGoogleRoutes({ origin, destination, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE' });
    const route = result.routes[0];
    if (route && route.distanceMeters > 0 && route.durationSeconds > 0) {
      return { source: 'DRIVING', distanceMeters: route.distanceMeters, etaSeconds: route.durationSeconds };
    }
  } catch {
    // Explicitly mark routing fallback; candidates with driving ETAs rank ahead of fallback candidates.
  }
  return { source: 'STRAIGHT_LINE_FALLBACK', distanceMeters: Math.round(straightLineMeters) };
};
export const rankDispatchCandidates = (candidates: DispatchCandidate[]) => [...candidates].sort((a, b) => {
  if (a.route.source !== b.route.source) return a.route.source === 'DRIVING' ? -1 : 1;
  if (a.route.source === 'DRIVING' && b.route.source === 'DRIVING') return (a.route.etaSeconds ?? Number.MAX_SAFE_INTEGER) - (b.route.etaSeconds ?? Number.MAX_SAFE_INTEGER);
  return a.straightLineMeters - b.straightLineMeters;
});
const hospitalCapabilityTerms: Record<string, RegExp> = {
  accident_injury: /trauma|accident|emergency|critical|orthop|surg|icu/i,
  severe_bleeding: /trauma|bleed|emergency|critical|surg|icu/i,
  breathing_difficulty: /respirat|pulmon|emergency|critical|icu/i,
  chest_pain: /cardio|heart|stemi|cath|emergency|critical|icu/i,
  stroke_symptoms: /stroke|neuro|brain|emergency|critical|icu/i,
  unconscious_person: /emergency|critical|icu|neuro|trauma/i,
  burn: /burn|trauma|emergency|critical|surg|icu/i,
  other: /emergency|critical|urgent|icu/i,
};
const hospitalMatchesDispatchCategory = (hospital: { hospitalType: string; services?: string[]; capabilities?: string[] }, category: string) => {
  const terms = hospitalCapabilityTerms[category] ?? /emergency|critical|urgent|icu/i;
  return [hospital.hospitalType, ...(hospital.services ?? []), ...(hospital.capabilities ?? [])].some((value) => terms.test(value));
};
const hospitalEligibleForJob = async (job: DispatchJobLean) => {
  const hospital = await HospitalModel.findOne({
    _id: job.hospitalId,
    accountStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    emergencyAvailability: { $in: ['AVAILABLE', 'LIMITED'] },
  }).select('hospitalType services capabilities').lean().exec();
  return Boolean(hospital && hospitalMatchesDispatchCategory(hospital, job.category));
};

const attemptFor = (job: DispatchJobLean, attemptId: string) => job.attempts.find((attempt) => attempt.attemptId === attemptId);
export const isDispatchLocationFresh = (updatedAt: Date | undefined, now: Date) => Boolean(updatedAt && updatedAt.getTime() <= now.getTime() + DRIVER_LOCATION_MAX_FUTURE_SKEW_MS && updatedAt.getTime() >= now.getTime() - DISPATCH_LOCATION_FRESHNESS_MS);
const isFresh = isDispatchLocationFresh;
export const isDispatchOfferAcceptable = (status: string, deadlineAt: Date | undefined, now: Date) => status === 'OFFERED' && Boolean(deadlineAt && deadlineAt.getTime() > now.getTime());
const appendEvent = (event: string, reason?: string, actorId?: Types.ObjectId, actorRole: 'SYSTEM' | 'ADMIN' | 'AMBULANCE_DRIVER' | 'USER' = 'SYSTEM', attemptId?: string) => ({
  event, at: new Date(), actorId, actorRole, reason, attemptId,
});

const releaseReservationInSession = async (jobId: Types.ObjectId, ambulanceId?: Types.ObjectId, driverId?: Types.ObjectId, session?: import('mongoose').ClientSession) => {
  if (ambulanceId) {
    await AmbulanceModel.updateOne(
      { _id: ambulanceId, dispatchReservationId: jobId },
      { $unset: { dispatchReservationId: 1, dispatchReservationExpiresAt: 1 } },
      session ? { session } : undefined,
    ).exec();
  }
  if (driverId) {
    await AmbulanceDriverModel.updateOne(
      { _id: driverId, dispatchReservationId: jobId },
      { $unset: { dispatchReservationId: 1, dispatchReservationExpiresAt: 1 } },
      session ? { session } : undefined,
    ).exec();
  }
};

const eligibleCandidatePool = async (job: DispatchJobLean, exactDriverId?: Types.ObjectId): Promise<DispatchCandidate[]> => {
  const now = new Date();
  const providerIds = (await AmbulanceProviderModel.find({ accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' }).select('_id').lean().exec()).map((provider) => provider._id);
  if (!providerIds.length) return [];
  const reservationAvailable = { $or: [
    { dispatchReservationId: { $exists: false } },
    { dispatchReservationId: null },
    { dispatchReservationExpiresAt: { $lte: now } },
  ] };
  const ambulanceFilter: QueryFilter<AmbulanceDocument> = {
    providerId: { $in: providerIds },
    accountStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    currentStatus: 'AVAILABLE',
    locationUpdatedAt: { $gte: new Date(now.getTime() - DISPATCH_LOCATION_FRESHNESS_MS), $lte: new Date(now.getTime() + DRIVER_LOCATION_MAX_FUTURE_SKEW_MS) },
    ...reservationAvailable,
  };
  const ambulances = await AmbulanceModel.find(ambulanceFilter).select('_id providerId currentLatitude currentLongitude location locationUpdatedAt currentStatus accountStatus verificationStatus dispatchReservationId dispatchReservationExpiresAt').limit(500).lean().exec();
  if (!ambulances.length) return [];
  const ambulanceIds = ambulances.map((ambulance) => ambulance._id);
  const driverFilter: QueryFilter<AmbulanceDriverDocument> = {
    _id: exactDriverId ?? { $exists: true },
    assignedAmbulanceId: { $in: ambulanceIds },
    providerId: { $in: providerIds },
    accountStatus: 'ACTIVE',
    licenseVerificationStatus: 'VERIFIED',
    availabilityStatus: 'ONLINE',
    ...reservationAvailable,
  };
  const drivers = await AmbulanceDriverModel.find(driverFilter).select('_id providerId assignedAmbulanceId accountStatus licenseVerificationStatus availabilityStatus dispatchReservationId dispatchReservationExpiresAt').limit(500).lean().exec();
  if (!drivers.length) return [];
  const activeTrips = await TripModel.find({
    status: { $in: DISPATCH_ACTIVE_TRIP_STATUSES },
    $or: [{ ambulanceId: { $in: ambulanceIds } }, { driverId: { $in: drivers.map((driver) => driver._id) } }],
  }).select('ambulanceId driverId').lean().exec();
  const busyAmbulanceIds = new Set(activeTrips.map((trip) => String(trip.ambulanceId)));
  const busyDriverIds = new Set(activeTrips.filter((trip) => trip.driverId).map((trip) => String(trip.driverId)));
  const driversByAmbulance = new Map<string, typeof drivers[number]>();
  const ambiguousAmbulances = new Set<string>();
  for (const driver of drivers) {
    const ambulanceId = driver.assignedAmbulanceId ? String(driver.assignedAmbulanceId) : '';
    if (!ambulanceId || String(driver.providerId) !== String(ambulances.find((ambulance) => String(ambulance._id) === ambulanceId)?.providerId)) continue;
    if (driversByAmbulance.has(ambulanceId)) {
      ambiguousAmbulances.add(ambulanceId);
      driversByAmbulance.delete(ambulanceId);
      continue;
    }
    if (!ambiguousAmbulances.has(ambulanceId)) driversByAmbulance.set(ambulanceId, driver);
  }
  const attemptedDrivers = new Set(job.attempts.filter((attempt) => attempt.generation === job.generation).map((attempt) => String(attempt.driverId)));
  const pickup = { latitude: job.pickupLatitude, longitude: job.pickupLongitude };
  const pool: DispatchCandidate[] = [];
  for (const ambulance of ambulances) {
    const driver = driversByAmbulance.get(String(ambulance._id));
    if (ambiguousAmbulances.has(String(ambulance._id)) || !driver || busyAmbulanceIds.has(String(ambulance._id)) || busyDriverIds.has(String(driver._id))) continue;
    if (attemptedDrivers.has(String(driver._id))) continue;
    if (exactDriverId && String(driver._id) !== String(exactDriverId)) continue;
    if (!isFresh(ambulance.locationUpdatedAt, now)) continue;
    const coordinates = ambulanceCoordinates(ambulance);
    if (!coordinates) continue;
    const straightLineMeters = haversineMeters(coordinates, pickup);
    if (straightLineMeters > DISPATCH_SEARCH_RADIUS_METERS) continue;
    pool.push({
      providerId: ambulance.providerId,
      ambulanceId: ambulance._id,
      driverId: driver._id,
      coordinates,
      straightLineMeters,
      route: { source: 'STRAIGHT_LINE_FALLBACK', distanceMeters: Math.round(straightLineMeters) },
    });
  }
  pool.sort((a, b) => a.straightLineMeters - b.straightLineMeters);
  const routeCandidates = pool.slice(0, DISPATCH_ROUTE_CANDIDATE_LIMIT);
  const routedPool: DispatchCandidate[] = [];
  for (let index = 0; index < routeCandidates.length; index += 5) {
    const batch = await Promise.all(routeCandidates.slice(index, index + 5).map(async (candidate) => ({
      ...candidate,
      route: await routeRank(candidate.coordinates, pickup, candidate.straightLineMeters),
    })));
    routedPool.push(...batch);
  }
  return rankDispatchCandidates(routedPool);
};

export const reserveAndOffer = async (job: DispatchJobLean, candidate: DispatchCandidate, actor?: { id: Types.ObjectId; role: 'ADMIN' }) => {
  const now = new Date();
  const deadlineAt = new Date(now.getTime() + DISPATCH_OFFER_TIMEOUT_MS);
  const attemptId = randomUUID();
  const session = await startSession();
  let result: { job: DispatchJobLean; attempt: DispatchAttemptDocument } | null = null;
  try {
    await session.withTransaction(async () => {
      const currentJob = await DispatchJobModel.findOne({
        _id: job._id,
        status: 'SEARCHING',
        leaseToken: job.leaseToken,
      }).session(session).lean().exec() as DispatchJobLean | null;
      if (!currentJob) throw new AppError('DISPATCH_STATE_CONFLICT', 'Dispatch job changed before a driver could be reserved', 409);
      const request = await EmergencyRequestModel.findOne({
        _id: currentJob.emergencyRequestId,
        status: 'AMBULANCE_COORDINATION',
        hospitalId: currentJob.hospitalId,
      }).session(session).lean().exec();
      if (!request) throw new AppError('EMERGENCY_NOT_DISPATCHABLE', 'Emergency request is no longer eligible for dispatch', 409);
      const hospital = await HospitalModel.findOne({
        _id: currentJob.hospitalId, accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED',
        emergencyAvailability: { $in: ['AVAILABLE', 'LIMITED'] },
      }).select('hospitalType services capabilities').session(session).lean().exec();
      if (!hospital || !hospitalMatchesDispatchCategory(hospital, currentJob.category)) {
        throw new AppError('HOSPITAL_NO_LONGER_ELIGIBLE', 'Selected hospital is no longer eligible for this emergency. Dispatch stopped; operations must coordinate a new destination.', 409);
      }
      const provider = await AmbulanceProviderModel.findOne({ _id: candidate.providerId, accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' }).session(session).lean().exec();
      const driver = await AmbulanceDriverModel.findOne({
        _id: candidate.driverId,
        providerId: candidate.providerId,
        assignedAmbulanceId: candidate.ambulanceId,
        accountStatus: 'ACTIVE',
        licenseVerificationStatus: 'VERIFIED',
        availabilityStatus: 'ONLINE',
        $or: [{ dispatchReservationId: { $exists: false } }, { dispatchReservationId: null }, { dispatchReservationExpiresAt: { $lte: now } }],
      }).session(session).lean().exec();
      const ambulance = await AmbulanceModel.findOne({
        _id: candidate.ambulanceId,
        providerId: candidate.providerId,
        accountStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        currentStatus: 'AVAILABLE',
        locationUpdatedAt: { $gte: new Date(now.getTime() - DISPATCH_LOCATION_FRESHNESS_MS), $lte: new Date(now.getTime() + DRIVER_LOCATION_MAX_FUTURE_SKEW_MS) },
        $or: [{ dispatchReservationId: { $exists: false } }, { dispatchReservationId: null }, { dispatchReservationExpiresAt: { $lte: now } }],
      }).session(session).lean().exec();
      if (!provider || !driver || !ambulance || !isFresh(ambulance.locationUpdatedAt, now) || !ambulanceCoordinates(ambulance)) {
        throw new AppError('DISPATCH_CANDIDATE_UNAVAILABLE', 'Candidate eligibility changed before reservation; searching for another driver', 409);
      }
      const activeTrip = await TripModel.exists({
        status: { $in: DISPATCH_ACTIVE_TRIP_STATUSES },
        $or: [{ ambulanceId: candidate.ambulanceId }, { driverId: candidate.driverId }],
      }).session(session).exec();
      if (activeTrip) throw new AppError('DISPATCH_CANDIDATE_BUSY', 'Candidate already has an active trip', 409);

      const reservedAmbulance = await AmbulanceModel.findOneAndUpdate({
        _id: candidate.ambulanceId,
        providerId: candidate.providerId,
        currentStatus: 'AVAILABLE',
        accountStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        $or: [{ dispatchReservationId: { $exists: false } }, { dispatchReservationId: null }, { dispatchReservationExpiresAt: { $lte: now } }],
      }, { $set: { dispatchReservationId: currentJob._id, dispatchReservationExpiresAt: deadlineAt } }, { new: true, session }).lean().exec();
      if (!reservedAmbulance) throw new AppError('DISPATCH_RESERVATION_CONFLICT', 'Ambulance was reserved by another dispatch', 409);
      const reservedDriver = await AmbulanceDriverModel.findOneAndUpdate({
        _id: candidate.driverId,
        providerId: candidate.providerId,
        assignedAmbulanceId: candidate.ambulanceId,
        accountStatus: 'ACTIVE',
        licenseVerificationStatus: 'VERIFIED',
        availabilityStatus: 'ONLINE',
        $or: [{ dispatchReservationId: { $exists: false } }, { dispatchReservationId: null }, { dispatchReservationExpiresAt: { $lte: now } }],
      }, { $set: { dispatchReservationId: currentJob._id, dispatchReservationExpiresAt: deadlineAt } }, { new: true, session }).lean().exec();
      if (!reservedDriver) throw new AppError('DISPATCH_RESERVATION_CONFLICT', 'Driver was reserved by another dispatch', 409);

      const attempt: DispatchAttemptDocument = {
        attemptId,
        generation: currentJob.generation,
        attemptNumber: currentJob.attempts.filter((entry) => entry.generation === currentJob.generation).length + 1,
        providerId: candidate.providerId,
        ambulanceId: candidate.ambulanceId,
        driverId: candidate.driverId,
        status: 'OFFERED',
        offeredAt: now,
        deadlineAt,
        routeSource: candidate.route.source,
        routeDistanceMeters: candidate.route.distanceMeters,
        etaSeconds: candidate.route.etaSeconds,
      };
      const update = await DispatchJobModel.findOneAndUpdate({
        _id: currentJob._id,
        status: currentJob.status,
        leaseToken: job.leaseToken,
      }, {
        $set: {
          status: 'OFFERED',
          generation: attempt.generation,
          currentAttemptId: attemptId,
          currentProviderId: candidate.providerId,
          currentAmbulanceId: candidate.ambulanceId,
          currentDriverId: candidate.driverId,
          deadlineAt,
        },
        $unset: { leaseUntil: 1, leaseToken: 1, nextAttemptAt: 1 },
        $push: { attempts: attempt, events: appendEvent(actor ? 'MANUAL_OFFER_CREATED' : 'OFFER_CREATED', actor ? 'Manual dispatch by administrator' : undefined, actor?.id, actor?.role ?? 'SYSTEM', attemptId) },
      }, { new: true, session }).lean().exec() as DispatchJobLean | null;
      if (!update) throw new AppError('DISPATCH_STATE_CONFLICT', 'Dispatch state changed before the offer could be saved', 409);
      result = { job: update, attempt };
    });
  } finally {
    await session.endSession();
  }
  const completed = result as { job: DispatchJobLean; attempt: DispatchAttemptDocument } | null;
  if (!completed) throw new AppError('DISPATCH_OFFER_FAILED', 'Offer could not be committed', 500);
  return completed;
};

const markExhausted = async (job: DispatchJobLean, reason: string) => {
  const now = new Date();
  await DispatchJobModel.updateOne(
    { _id: job._id, status: 'SEARCHING', leaseToken: job.leaseToken },
    {
      $set: { status: 'EXHAUSTED', exhaustedAt: now },
      $unset: { leaseUntil: 1, leaseToken: 1, currentAttemptId: 1, currentProviderId: 1, currentAmbulanceId: 1, currentDriverId: 1, deadlineAt: 1 },
      $push: { events: appendEvent('DISPATCH_EXHAUSTED', reason) },
    },
  ).exec();
};

const claimJob = async () => {
  const now = new Date();
  const leaseToken = randomUUID();
  const job = await DispatchJobModel.findOneAndUpdate({
    $or: [
      { status: 'PENDING', $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] },
      { status: 'SEARCHING', leaseUntil: { $lte: now } },
    ],
  }, {
    $set: { status: 'SEARCHING', leaseUntil: new Date(now.getTime() + LEASE_MS), leaseToken },
    $push: { events: appendEvent('SEARCH_STARTED') },
  }, { new: true, sort: { createdAt: 1 } }).lean().exec() as DispatchJobLean | null;
  if (!job) return null;
  return job;
};

const searchAndOffer = async (job: DispatchJobLean) => {
  if (!(await hospitalEligibleForJob(job))) {
    await markExhausted(job, 'Selected hospital is no longer eligible for this emergency. Do not dispatch to this destination; operations must coordinate a new destination.');
    return;
  }
  const candidates = await eligibleCandidatePool(job);
  for (const candidate of candidates) {
    try {
      const result = await reserveAndOffer(job, candidate);
      if (result) return;
    } catch (error) {
      if (error instanceof AppError && error.code === 'HOSPITAL_NO_LONGER_ELIGIBLE') {
        await markExhausted(job, error.message);
        return;
      }
      if (!(error instanceof AppError) || !['DISPATCH_CANDIDATE_UNAVAILABLE', 'DISPATCH_CANDIDATE_BUSY', 'DISPATCH_RESERVATION_CONFLICT'].includes(error.code)) throw error;
    }
  }
  await markExhausted(job, candidates.length ? 'All ranked candidates became unavailable before reservation.' : 'No eligible on-duty driver with a fresh location and an available verified ambulance was found.');
};

const expireOrReleaseOffer = async (job: DispatchJobLean, reason: string, outcome: DispatchAttemptStatus) => {
  const attemptId = job.currentAttemptId;
  if (!attemptId) return;
  const attempt = attemptFor(job, attemptId);
  if (!attempt) return;
  const now = new Date();
  const session = await startSession();
  let updated: DispatchJobLean | null = null;
  try {
    await session.withTransaction(async () => {
      updated = await DispatchJobModel.findOneAndUpdate({
        _id: job._id,
        status: 'OFFERED',
        currentAttemptId: attemptId,
        ...(outcome === 'EXPIRED' ? { deadlineAt: { $lte: now } } : {}),
      }, {
        $set: {
          status: 'PENDING',
          'attempts.$[attempt].status': outcome,
          'attempts.$[attempt].respondedAt': now,
          'attempts.$[attempt].reason': reason,
          nextAttemptAt: now,
        },
        $unset: { currentAttemptId: 1, currentProviderId: 1, currentAmbulanceId: 1, currentDriverId: 1, deadlineAt: 1 },
        $push: { events: appendEvent(outcome === 'REJECTED' ? 'OFFER_REJECTED' : outcome === 'EXPIRED' ? 'OFFER_EXPIRED' : 'OFFER_RELEASED', reason, undefined, 'SYSTEM', attemptId) },
      }, { new: true, session, arrayFilters: [{ 'attempt.attemptId': attemptId }] }).lean().exec() as DispatchJobLean | null;
      if (!updated) return;
      await releaseReservationInSession(job._id, attempt.ambulanceId, attempt.driverId, session);
    });
  } finally {
    await session.endSession();
  }
};

const candidateStillEligible = async (job: DispatchJobLean, attempt: DispatchAttemptDocument) => {
  const now = new Date();
  const [provider, driver, ambulance, activeTrip] = await Promise.all([
    AmbulanceProviderModel.exists({ _id: attempt.providerId, accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' }),
    AmbulanceDriverModel.findOne({
      _id: attempt.driverId, providerId: attempt.providerId, assignedAmbulanceId: attempt.ambulanceId,
      accountStatus: 'ACTIVE', licenseVerificationStatus: 'VERIFIED', availabilityStatus: 'ONLINE',
      dispatchReservationId: job._id, dispatchReservationExpiresAt: { $gt: now },
    }).select('_id').lean().exec(),
    AmbulanceModel.findOne({
      _id: attempt.ambulanceId, providerId: attempt.providerId, accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED',
      currentStatus: 'AVAILABLE', dispatchReservationId: job._id, dispatchReservationExpiresAt: { $gt: now },
      locationUpdatedAt: { $gte: new Date(now.getTime() - DISPATCH_LOCATION_FRESHNESS_MS), $lte: new Date(now.getTime() + DRIVER_LOCATION_MAX_FUTURE_SKEW_MS) },
    }).select('_id').lean().exec(),
    TripModel.exists({ status: { $in: DISPATCH_ACTIVE_TRIP_STATUSES }, $or: [{ ambulanceId: attempt.ambulanceId }, { driverId: attempt.driverId }] }),
  ]);
  return Boolean(provider && driver && ambulance && !activeTrip);
};

let lastOrphanRecoveryAt = 0;
export const recoverOrphanedDispatchJobs = async () => {
  const nowMs = Date.now();
  if (nowMs - lastOrphanRecoveryAt < 30_000) return;
  lastOrphanRecoveryAt = nowMs;
  const orphaned = await EmergencyRequestModel.aggregate<{
    _id: Types.ObjectId; hospitalId: Types.ObjectId; userId: Types.ObjectId; category?: string;
    latitude: number; longitude: number; createdAt: Date;
  }>([
    { $match: { status: 'AMBULANCE_COORDINATION', ambulanceId: { $exists: false }, latitude: { $type: 'number', $gte: -90, $lte: 90 }, longitude: { $type: 'number', $gte: -180, $lte: 180 } } },
    { $lookup: { from: DispatchJobModel.collection.name, localField: '_id', foreignField: 'emergencyRequestId', as: 'dispatchJobs' } },
    { $match: { dispatchJobs: { $eq: [] } } },
    { $sort: { createdAt: 1 } },
    { $limit: 100 },
    { $project: { hospitalId: 1, userId: 1, category: 1, latitude: 1, longitude: 1 } },
  ]).exec();
  for (const request of orphaned) {
    await DispatchJobModel.findOneAndUpdate({ emergencyRequestId: request._id }, {
      $setOnInsert: {
        emergencyRequestId: request._id, hospitalId: request.hospitalId, userId: request.userId,
        category: request.category ?? 'other', pickupLatitude: request.latitude, pickupLongitude: request.longitude,
        status: 'PENDING', generation: 1, attempts: [],
        events: [appendEvent('ORPHAN_DISPATCH_RECOVERED', 'Recovered a persisted emergency without a dispatch job')],
      },
    }, { upsert: true, setDefaultsOnInsert: true }).exec();
  }
};

export const processDispatchTick = async () => {
  await recoverOrphanedDispatchJobs();
  const now = new Date();
  const expired = await DispatchJobModel.find({ status: 'OFFERED', deadlineAt: { $lte: now } }).limit(50).lean().exec() as DispatchJobLean[];
  for (const job of expired) await expireOrReleaseOffer(job, 'Driver acceptance deadline expired.', 'EXPIRED');

  const offered = await DispatchJobModel.find({ status: 'OFFERED', deadlineAt: { $gt: now } }).limit(50).lean().exec() as DispatchJobLean[];
  for (const job of offered) {
    const attempt = job.currentAttemptId ? attemptFor(job, job.currentAttemptId) : undefined;
    if (attempt && !(await candidateStillEligible(job, attempt))) await expireOrReleaseOffer(job, 'Driver, provider, ambulance, location, or reservation became ineligible during the offer.', 'UNAVAILABLE');
  }

  const claimedJobs: DispatchJobLean[] = [];
  for (let index = 0; index < 3; index += 1) {
    const claimed = await claimJob();
    if (!claimed) break;
    claimedJobs.push(claimed);
  }
  await Promise.all(claimedJobs.map(async (claimed) => {
    try {
      await searchAndOffer(claimed);
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 300) : 'Dispatch worker failed while searching candidates.';
      await DispatchJobModel.updateOne({ _id: claimed._id, status: 'SEARCHING', leaseToken: claimed.leaseToken }, {
        $set: { status: 'PENDING', nextAttemptAt: new Date(Date.now() + 5_000) },
        $unset: { leaseUntil: 1, leaseToken: 1 },
        $push: { events: appendEvent('SEARCH_RETRY_SCHEDULED', reason) },
      }).exec();
    }
  }));
};

export const startDispatchWorker = () => {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void processDispatchTick().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown dispatch worker error';
      console.error('Dispatch worker tick failed:', message);
    }).finally(() => { running = false; });
  }, 1_000);
  timer.unref();
  void processDispatchTick().catch((error: unknown) => console.error('Initial dispatch recovery failed:', error instanceof Error ? error.message : 'Unknown error'));
  return () => clearInterval(timer);
};

export const acceptDispatchOffer = async (driverId: string, dispatchJobId: string) => {
  const did = id(driverId, 'driver');
  const jid = id(dispatchJobId, 'dispatch job');
  const now = new Date();
  const jobBefore = await DispatchJobModel.findById(jid).lean().exec() as DispatchJobLean | null;
  if (!jobBefore) throw new AppError('DISPATCH_NOT_FOUND', 'Dispatch job not found', 404);
  if (jobBefore.status === 'ACCEPTED' && jobBefore.currentDriverId && String(jobBefore.currentDriverId) === String(did) && jobBefore.acceptedTripId) {
    const existing = await TripModel.findById(jobBefore.acceptedTripId).lean().exec();
    if (existing) return { dispatchJobId: String(jid), tripId: String(existing._id), emergencyRequestId: String(existing.emergencyRequestId), status: 'ACCEPTED' as const, duplicate: true };
  }
  if (!isDispatchOfferAcceptable(jobBefore.status, jobBefore.deadlineAt, now) || String(jobBefore.currentDriverId) !== String(did) || !jobBefore.currentAttemptId) {
    throw new AppError('DISPATCH_OFFER_NOT_ACTIVE', 'This offer is no longer active for this driver', 409);
  }
  if (!jobBefore.deadlineAt || jobBefore.deadlineAt.getTime() <= now.getTime()) {
    await expireOrReleaseOffer(jobBefore, 'Acceptance arrived after the server deadline.', 'EXPIRED');
    throw new AppError('DISPATCH_OFFER_EXPIRED', 'The acceptance deadline has passed. This offer cannot be accepted now.', 409);
  }
  const attempt = attemptFor(jobBefore, jobBefore.currentAttemptId);
  if (!attempt) throw new AppError('DISPATCH_ATTEMPT_NOT_FOUND', 'Current dispatch attempt was not found', 409);
  const session = await startSession();
  let result: { tripId: string; emergencyRequestId: string; hospitalId: string; requestCode: string; etaMinutes?: number; routeSource: string } | null = null;
  try {
    await session.withTransaction(async () => {
      const job = await DispatchJobModel.findOne({
        _id: jid, status: 'OFFERED', currentAttemptId: attempt.attemptId, currentDriverId: did, deadlineAt: { $gt: new Date() },
      }).session(session).lean().exec() as DispatchJobLean | null;
      if (!job) throw new AppError('DISPATCH_OFFER_NOT_ACTIVE', 'Offer expired or was consumed by another action', 409);
      const request = await EmergencyRequestModel.findOne({ _id: job.emergencyRequestId, hospitalId: job.hospitalId, status: 'AMBULANCE_COORDINATION', ambulanceId: { $exists: false } }).session(session).lean().exec();
      if (!request) throw new AppError('EMERGENCY_NOT_DISPATCHABLE', 'Emergency request was cancelled, assigned, or changed', 409);
      const [provider, driver, ambulance] = await Promise.all([
        AmbulanceProviderModel.findOne({ _id: attempt.providerId, accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' }).session(session).lean().exec(),
        AmbulanceDriverModel.findOne({ _id: did, providerId: attempt.providerId, assignedAmbulanceId: attempt.ambulanceId, accountStatus: 'ACTIVE', licenseVerificationStatus: 'VERIFIED', availabilityStatus: 'ONLINE', dispatchReservationId: jid, dispatchReservationExpiresAt: { $gt: new Date() } }).session(session).lean().exec(),
        AmbulanceModel.findOne({ _id: attempt.ambulanceId, providerId: attempt.providerId, currentStatus: 'AVAILABLE', accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED', dispatchReservationId: jid, dispatchReservationExpiresAt: { $gt: new Date() }, locationUpdatedAt: { $gte: new Date(Date.now() - DISPATCH_LOCATION_FRESHNESS_MS) } }).session(session).lean().exec(),
      ]);
      if (!provider || !driver || !ambulance || !isFresh(ambulance.locationUpdatedAt, new Date()) || !ambulanceCoordinates(ambulance)) {
        throw new AppError('DISPATCH_CANDIDATE_UNAVAILABLE', 'Driver or ambulance no longer satisfies dispatch eligibility', 409);
      }
      const activeTrip = await TripModel.exists({ status: { $in: DISPATCH_ACTIVE_TRIP_STATUSES }, $or: [{ ambulanceId: attempt.ambulanceId }, { driverId: did }] }).session(session).exec();
      if (activeTrip) throw new AppError('ACTIVE_TRIP_EXISTS', 'Driver or ambulance already has an active trip', 409);
      const existingTrip = await TripModel.findOne({ emergencyRequestId: job.emergencyRequestId }).session(session).lean().exec();
      if (existingTrip) throw new AppError('TRIP_ALREADY_EXISTS', 'An active or historical trip already exists for this emergency', 409);
      const hospital = await HospitalModel.findOne({ _id: job.hospitalId, accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED', emergencyAvailability: { $in: ['AVAILABLE', 'LIMITED'] } }).select('hospitalType services capabilities').session(session).lean().exec();
      if (!hospital || !hospitalMatchesDispatchCategory(hospital, job.category)) throw new AppError('HOSPITAL_NO_LONGER_ELIGIBLE', 'Selected hospital is no longer eligible; do not transport the patient to this destination', 409);

      const trip = new TripModel({
        emergencyRequestId: job.emergencyRequestId,
        providerId: attempt.providerId,
        ambulanceId: attempt.ambulanceId,
        driverId: did,
        destinationHospitalId: job.hospitalId,
        status: 'ACCEPTED',
        acceptedAt: now,
        statusHistory: [{ status: 'ACCEPTED', changedAt: now, actorId: did, actorRole: 'AMBULANCE_DRIVER' }],
      });
      await trip.save({ session });
      const updatedRequest = await EmergencyRequestModel.findOneAndUpdate({
        _id: job.emergencyRequestId, status: 'AMBULANCE_COORDINATION', ambulanceId: { $exists: false },
      }, { $set: { ambulanceProviderId: attempt.providerId, ambulanceId: attempt.ambulanceId, driverId: did } }, { new: true, session }).lean().exec();
      if (!updatedRequest) throw new AppError('EMERGENCY_ASSIGNMENT_CONFLICT', 'Another dispatch action assigned this emergency first', 409);
      const acceptanceGuardTime = new Date();
      const updatedJob = await DispatchJobModel.findOneAndUpdate({
        _id: jid, status: 'OFFERED', currentAttemptId: attempt.attemptId, currentDriverId: did, deadlineAt: { $gt: acceptanceGuardTime },
      }, {
        $set: { status: 'ACCEPTED', acceptedTripId: trip._id, 'attempts.$[attempt].status': 'ACCEPTED', 'attempts.$[attempt].respondedAt': acceptanceGuardTime },
        $unset: { deadlineAt: 1, leaseUntil: 1, leaseToken: 1 },
        $push: { events: appendEvent('OFFER_ACCEPTED', undefined, did, 'AMBULANCE_DRIVER', attempt.attemptId) },
      }, { new: true, session, arrayFilters: [{ 'attempt.attemptId': attempt.attemptId }] }).lean().exec();
      if (!updatedJob) throw new AppError('DISPATCH_STATE_CONFLICT', 'Offer was consumed before acceptance could commit', 409);
      const changedAmbulance = await AmbulanceModel.findOneAndUpdate({ _id: attempt.ambulanceId, dispatchReservationId: jid, currentStatus: 'AVAILABLE' }, { $set: { currentStatus: 'BUSY' }, $unset: { dispatchReservationId: 1, dispatchReservationExpiresAt: 1 } }, { new: true, session }).lean().exec();
      const changedDriver = await AmbulanceDriverModel.findOneAndUpdate({ _id: did, dispatchReservationId: jid, availabilityStatus: 'ONLINE' }, { $set: { availabilityStatus: 'BUSY' }, $unset: { dispatchReservationId: 1, dispatchReservationExpiresAt: 1 } }, { new: true, session }).lean().exec();
      if (!changedAmbulance || !changedDriver) throw new AppError('DISPATCH_RESERVATION_CONFLICT', 'Reservation could not be converted into an active trip', 409);
      await HospitalPatientModel.updateOne({ emergencyId: job.emergencyRequestId, hospitalId: job.hospitalId }, { $set: { ambulanceId: attempt.ambulanceId, etaMinutes: request.etaMinutes } }, { session }).exec();
      result = { tripId: String(trip._id), emergencyRequestId: String(job.emergencyRequestId), hospitalId: String(job.hospitalId), requestCode: request.requestCode, etaMinutes: request.etaMinutes, routeSource: attempt.routeSource };
    });
  } finally {
    await session.endSession();
  }
  const acceptedResult = result as { tripId: string; emergencyRequestId: string; hospitalId: string; requestCode: string; etaMinutes?: number; routeSource: string } | null;
  if (!acceptedResult) throw new AppError('DISPATCH_ACCEPT_FAILED', 'Offer acceptance could not be committed', 500);
  return { dispatchJobId: String(jid), ...acceptedResult, status: 'ACCEPTED' };
};

export const rejectDispatchOffer = async (driverId: string, dispatchJobId: string) => {
  const did = id(driverId, 'driver');
  const jid = id(dispatchJobId, 'dispatch job');
  const job = await DispatchJobModel.findOne({ _id: jid, status: 'OFFERED', currentDriverId: did }).lean().exec() as DispatchJobLean | null;
  if (!job) throw new AppError('DISPATCH_OFFER_NOT_ACTIVE', 'This offer is no longer active for this driver', 409);
  if (job.deadlineAt && job.deadlineAt.getTime() <= Date.now()) {
    await expireOrReleaseOffer(job, 'Rejection arrived after the deadline.', 'EXPIRED');
    throw new AppError('DISPATCH_OFFER_EXPIRED', 'This offer already expired', 409);
  }
  await expireOrReleaseOffer(job, 'Driver explicitly rejected the offer.', 'REJECTED');
  return { dispatchJobId: String(jid), status: 'REJECTED', reassignmentQueued: true };
};

export const listDriverDispatchOffers = async (driverId: string) => {
  const did = id(driverId, 'driver');
  const driver = await AmbulanceDriverModel.findOne({ _id: did, accountStatus: 'ACTIVE', licenseVerificationStatus: 'VERIFIED' }).select('_id').lean().exec();
  if (!driver) throw new AppError('DRIVER_NOT_OPERATIONAL', 'Driver is not verified and active', 403);
  const jobs = await DispatchJobModel.find({ currentDriverId: did, status: 'OFFERED', deadlineAt: { $gt: new Date() } }).sort({ deadlineAt: 1 }).limit(20).lean().exec() as DispatchJobLean[];
  return Promise.all(jobs.map(async (job) => {
    const attempt = job.currentAttemptId ? attemptFor(job, job.currentAttemptId) : undefined;
    const request = await EmergencyRequestModel.findById(job.emergencyRequestId).select('requestCode situationType category location').lean().exec();
    const hospital = await HospitalModel.findById(job.hospitalId).select('name address city phone').lean().exec();
    return {
      dispatchJobId: String(job._id), attemptId: attempt?.attemptId, deadlineAt: job.deadlineAt,
      request: request ? { id: String(job.emergencyRequestId), requestCode: request.requestCode, situationType: request.situationType, category: request.category ?? job.category, pickup: { latitude: job.pickupLatitude, longitude: job.pickupLongitude, label: request.location ?? '' } } : undefined,
      hospital: hospital ? { id: String(job.hospitalId), name: hospital.name, address: hospital.address, city: hospital.city, phone: hospital.phone } : undefined,
      route: attempt ? { source: attempt.routeSource, distanceMeters: attempt.routeDistanceMeters, etaSeconds: attempt.etaSeconds } : undefined,
    };
  }));
};

export const listDispatchJobs = async (query: { status?: DispatchJobStatus; limit?: number } = {}) => {
  const filter: QueryFilter<DispatchJobDocument> = query.status ? { status: query.status } : {};
  const jobs = await DispatchJobModel.find(filter).sort({ updatedAt: -1 }).limit(Math.min(Math.max(query.limit ?? 50, 1), 100)).lean().exec() as DispatchJobLean[];
  return Promise.all(jobs.map(async (job) => {
    const request = await EmergencyRequestModel.findById(job.emergencyRequestId).select('requestCode situationType status').lean().exec();
    return {
      id: String(job._id), emergencyRequestId: String(job.emergencyRequestId), requestCode: request?.requestCode,
      situationType: request?.situationType, emergencyStatus: request?.status, hospitalId: String(job.hospitalId),
      category: job.category, status: job.status, generation: job.generation, attempts: job.attempts.map((attempt) => ({
        attemptNumber: attempt.attemptNumber, generation: attempt.generation, providerId: String(attempt.providerId),
        ambulanceId: String(attempt.ambulanceId), driverId: String(attempt.driverId), status: attempt.status,
        offeredAt: attempt.offeredAt, deadlineAt: attempt.deadlineAt, respondedAt: attempt.respondedAt,
        routeSource: attempt.routeSource, routeDistanceMeters: attempt.routeDistanceMeters, etaSeconds: attempt.etaSeconds, reason: attempt.reason,
      })),
      deadlineAt: job.deadlineAt, exhaustedAt: job.exhaustedAt, escalatedAt: job.escalatedAt, escalationReason: job.escalationReason,
      events: job.events, updatedAt: job.updatedAt,
    };
  }));
};

export const retryDispatchJob = async (adminId: string, dispatchJobId: string) => {
  const jid = id(dispatchJobId, 'dispatch job');
  const aid = id(adminId, 'admin');
  const now = new Date();
  const current = await DispatchJobModel.findOne({ _id: jid, status: { $in: ['EXHAUSTED', 'ESCALATED'] } }).lean().exec() as DispatchJobLean | null;
  const job = current ? await DispatchJobModel.findOneAndUpdate({ _id: jid, status: current.status, generation: current.generation }, {
    $set: { status: 'PENDING', generation: current.generation + 1, nextAttemptAt: now },
    $unset: { exhaustedAt: 1, escalatedAt: 1, escalationReason: 1 },
    $push: { events: appendEvent('MANUAL_RETRY', 'Administrator requested a new dispatch generation', aid, 'ADMIN') },
  }, { new: true }).lean().exec() as DispatchJobLean | null : null;
  if (!job) throw new AppError('DISPATCH_NOT_RETRYABLE', 'Only exhausted or escalated dispatch jobs can be retried', 409);
  return { id: String(job._id), status: job.status, generation: job.generation, queued: true };
};

export const manualAssignDispatchJob = async (adminId: string, dispatchJobId: string, driverId: string) => {
  const jid = id(dispatchJobId, 'dispatch job');
  const aid = id(adminId, 'admin');
  const did = id(driverId, 'driver');
  let job = await DispatchJobModel.findById(jid).lean().exec() as DispatchJobLean | null;
  if (!job) throw new AppError('DISPATCH_NOT_FOUND', 'Dispatch job not found', 404);
  if (!['EXHAUSTED', 'ESCALATED', 'PENDING'].includes(job.status)) throw new AppError('DISPATCH_NOT_MANUALLY_ASSIGNABLE', 'Manual assignment is allowed only when no offer is active', 409);
  if (job.status === 'EXHAUSTED' || job.status === 'ESCALATED') {
    job = await DispatchJobModel.findOneAndUpdate({ _id: jid, status: job.status }, {
      $set: { status: 'PENDING', generation: job.generation + 1 },
      $unset: { exhaustedAt: 1, escalatedAt: 1, escalationReason: 1, nextAttemptAt: 1 },
      $push: { events: appendEvent('MANUAL_ASSIGNMENT_STARTED', 'Administrator selected a specific driver', aid, 'ADMIN') },
    }, { new: true }).lean().exec() as DispatchJobLean | null;
  }
  if (!job) throw new AppError('DISPATCH_STATE_CONFLICT', 'Dispatch job changed before manual assignment', 409);
  const candidates = await eligibleCandidatePool(job, did);
  const candidate = candidates[0];
  if (!candidate) throw new AppError('MANUAL_DRIVER_INELIGIBLE', 'Selected driver is not currently eligible, on duty, assigned to a verified ambulance, and located freshly near the pickup', 409);
  const leaseToken = randomUUID();
  const claimed = await DispatchJobModel.findOneAndUpdate({ _id: jid, status: 'PENDING' }, {
    $set: { status: 'SEARCHING', leaseToken, leaseUntil: new Date(Date.now() + LEASE_MS) },
  }, { new: true }).lean().exec() as DispatchJobLean | null;
  if (!claimed) throw new AppError('DISPATCH_STATE_CONFLICT', 'Dispatch worker claimed this job before manual assignment', 409);
  try {
    const offered = await reserveAndOffer(claimed, candidate, { id: aid, role: 'ADMIN' });
    if (!offered) throw new AppError('MANUAL_ASSIGNMENT_FAILED', 'Could not reserve the selected driver', 409);
    return { dispatchJobId: String(jid), driverId: String(did), status: 'OFFERED', deadlineAt: offered.attempt.deadlineAt };
  } catch (error) {
    await DispatchJobModel.updateOne({ _id: jid, status: 'SEARCHING', leaseToken }, { $set: { status: 'PENDING', nextAttemptAt: new Date(Date.now() + 5_000) }, $unset: { leaseToken: 1, leaseUntil: 1 } }).exec();
    throw error;
  }
};

export const escalateDispatchJob = async (adminId: string, dispatchJobId: string, reason: string) => {
  const jid = id(dispatchJobId, 'dispatch job');
  const aid = id(adminId, 'admin');
  const now = new Date();
  const job = await DispatchJobModel.findOneAndUpdate({ _id: jid, status: 'EXHAUSTED' }, {
    $set: { status: 'ESCALATED', escalatedAt: now, escalationReason: reason },
    $push: { events: appendEvent('EMERGENCY_ESCALATED', reason, aid, 'ADMIN') },
  }, { new: true }).lean().exec() as DispatchJobLean | null;
  if (!job) throw new AppError('DISPATCH_NOT_ESCALATED', 'Only an exhausted dispatch job can be escalated', 409);
  const payload = { dispatchJobId: String(jid), emergencyRequestId: String(job.emergencyRequestId), status: 'ESCALATED', reason, emergencyCallNumber: '112' };
  return payload;
};

export const cancelDispatchForEmergencyInSession = async (emergencyRequestId: Types.ObjectId, actorId: Types.ObjectId, session: import('mongoose').ClientSession) => {
  const job = await DispatchJobModel.findOne({ emergencyRequestId }).session(session).lean().exec() as DispatchJobLean | null;
  if (!job || job.status === 'CANCELLED') return;
  const set: Record<string, unknown> = { status: 'CANCELLED' };
  const options: { session: import('mongoose').ClientSession; arrayFilters?: Array<Record<string, unknown>> } = { session };
  if (job.currentAttemptId && job.status === 'OFFERED') {
    set['attempts.$[attempt].status'] = 'CANCELLED';
    set['attempts.$[attempt].respondedAt'] = new Date();
    set['attempts.$[attempt].reason'] = 'Emergency request cancelled by user';
    options.arrayFilters = [{ 'attempt.attemptId': job.currentAttemptId }];
  }
  await DispatchJobModel.updateOne({ _id: job._id, status: job.status }, {
    $set: set,
    $unset: { deadlineAt: 1, leaseUntil: 1, leaseToken: 1, nextAttemptAt: 1 },
    $push: { events: appendEvent('DISPATCH_CANCELLED', 'Emergency request was cancelled by the user', actorId, 'USER', job.currentAttemptId) },
  }, options).exec();
  await releaseReservationInSession(job._id, job.currentAmbulanceId, job.currentDriverId, session);
};
