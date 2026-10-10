import { Types } from 'mongoose';
import type { AuthenticatedIdentity } from '../types/auth.js';
import { env } from '../config/env.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { DispatchJobModel } from '../models/DispatchJob.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { HospitalModel } from '../models/Hospital.js';
import { TripModel } from '../models/Trip.js';
import { calculateGoogleRoutes } from './mapsService.js';
import { AppError } from '../utils/AppError.js';

const ACTIVE_TRIP_STATUSES = ['ASSIGNED', 'ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'];
const TERMINAL_TRIP_STATUSES = ['COMPLETED', 'CANCELLED'];
const idOf = (value: string, label: string) => {
  if (!Types.ObjectId.isValid(value)) throw new AppError('INVALID_ID', `Invalid ${label} ID.`, 400);
  return new Types.ObjectId(value);
};
const coordinates = (place: { latitude?: number; longitude?: number; location?: { coordinates?: number[] } } | null) => {
  if (!place) return null;
  const latitude = typeof place.latitude === 'number' ? place.latitude : place.location?.coordinates?.[1];
  const longitude = typeof place.longitude === 'number' ? place.longitude : place.location?.coordinates?.[0];
  return typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : null;
};
export const canAccessTrackingSnapshot = (identity: AuthenticatedIdentity, emergency: { _id: Types.ObjectId; userId: Types.ObjectId; hospitalId: Types.ObjectId; ambulanceProviderId?: Types.ObjectId }, trip: { driverId?: Types.ObjectId; providerId: Types.ObjectId } | null): boolean => {
  if (identity.role === 'ADMIN') return true;
  if (identity.role === 'USER') return String(emergency.userId) === identity.id;
  if (identity.role === 'HOSPITAL') return String(emergency.hospitalId) === identity.id;
  if (identity.role === 'AMBULANCE_DRIVER') return Boolean(trip?.driverId && String(trip.driverId) === identity.id);
  if (identity.role === 'AMBULANCE_PROVIDER') return Boolean((trip && String(trip.providerId) === identity.id) || (emergency.ambulanceProviderId && String(emergency.ambulanceProviderId) === identity.id));
  return false;
};
export const trackingLocationIsFresh = (updatedAt: Date | string | null | undefined, now = new Date()): boolean => {
  if (!updatedAt) return false;
  const timestamp = new Date(updatedAt).getTime();
  const age = now.getTime() - timestamp;
  return Number.isFinite(timestamp) && age >= 0 && age <= env.DRIVER_LOCATION_STALE_AFTER_MS;
};
export const routeTargetForTripStatus = (status: string): 'PICKUP' | 'HOSPITAL' =>
  ['PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'].includes(status) ? 'HOSPITAL' : 'PICKUP';

export const getEmergencyTrackingSnapshot = async (identity: AuthenticatedIdentity, emergencyId: string) => {
  const emergency = await EmergencyRequestModel.findById(idOf(emergencyId, 'emergency')).lean().exec();
  if (!emergency) throw new AppError('NOT_FOUND', 'Emergency request not found.', 404);
  const trip = await TripModel.findOne({ emergencyRequestId: emergency._id }).sort({ createdAt: -1 }).lean().exec();
  if (!canAccessTrackingSnapshot(identity, emergency, trip)) throw new AppError('TRACKING_FORBIDDEN', 'You are not authorized to view this emergency tracking session.', 403);

  const hospitalDoc = await HospitalModel.findById(emergency.hospitalId).select('name address city state latitude longitude location phone').lean().exec();
  const hospitalCoordinates = coordinates(hospitalDoc);
  const accepted = Boolean(trip && trip.status !== 'ASSIGNED' && trip.status !== 'CANCELLED');
  const trackingActive = Boolean(trip && !TERMINAL_TRIP_STATUSES.includes(trip.status));
  const dispatch = trip ? null : await DispatchJobModel.findOne({ emergencyRequestId: emergency._id }).select('status attempts exhaustedAt escalatedAt escalationReason updatedAt').lean().exec();

  let ambulance: null | Record<string, unknown> = null;
  let location: null | Record<string, unknown> = null;
  if (accepted && trip) {
    const vehicle = await AmbulanceModel.findById(trip.ambulanceId).select('vehicleNumber registrationNumber ambulanceType currentLatitude currentLongitude locationUpdatedAt locationSourceTimestamp locationAccuracyMeters').lean().exec();
    const driver = trip.driverId ? await AmbulanceDriverModel.findById(trip.driverId).select('fullName').lean().exec() : null;
    if (vehicle) {
      ambulance = { id: String(trip.ambulanceId), vehicleNumber: vehicle.vehicleNumber, registrationNumber: vehicle.registrationNumber, ambulanceType: vehicle.ambulanceType, driverName: driver?.fullName ?? null };
      const hasCoords = typeof vehicle.currentLatitude === 'number' && typeof vehicle.currentLongitude === 'number';
      const updatedAt = vehicle.locationUpdatedAt ? new Date(vehicle.locationUpdatedAt) : null;
      const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : Number.POSITIVE_INFINITY;
      const fresh = trackingLocationIsFresh(updatedAt);
      location = {
        latitude: hasCoords ? vehicle.currentLatitude : null,
        longitude: hasCoords ? vehicle.currentLongitude : null,
        accuracyMeters: vehicle.locationAccuracyMeters ?? null,
        updatedAt: updatedAt?.toISOString() ?? null,
        sourceTimestamp: vehicle.locationSourceTimestamp ? new Date(vehicle.locationSourceTimestamp).toISOString() : null,
        ageMs: Number.isFinite(ageMs) ? Math.max(0, ageMs) : null,
        freshness: fresh && hasCoords ? 'FRESH' : 'STALE',
        coordinatesAreLive: Boolean(fresh && hasCoords && trackingActive),
      };
    }
  }

  const statusHistory = trip?.statusHistory?.map((entry) => ({ status: entry.status, changedAt: new Date(entry.changedAt).toISOString() })) ?? [];
  return {
    emergency: { id: String(emergency._id), requestCode: emergency.requestCode, status: emergency.status, situationType: emergency.situationType, reportedAt: new Date(emergency.reportedAt).toISOString(), updatedAt: new Date(emergency.updatedAt).toISOString() },
    pickup: { latitude: typeof emergency.latitude === 'number' ? emergency.latitude : null, longitude: typeof emergency.longitude === 'number' ? emergency.longitude : null, label: emergency.location ?? 'Confirmed pickup location' },
    hospital: { id: String(emergency.hospitalId), name: hospitalDoc?.name ?? 'Destination hospital', address: hospitalDoc?.address ?? '', city: hospitalDoc?.city ?? '', phone: hospitalDoc?.phone ?? null, latitude: hospitalCoordinates?.latitude ?? null, longitude: hospitalCoordinates?.longitude ?? null },
    dispatch: dispatch ? { status: dispatch.status, attemptCount: dispatch.attempts?.length ?? 0, exhaustedAt: dispatch.exhaustedAt?.toISOString() ?? null, escalatedAt: dispatch.escalatedAt?.toISOString() ?? null, escalationReason: dispatch.escalationReason ?? null, updatedAt: dispatch.updatedAt?.toISOString() ?? null } : null,
    trip: trip ? { id: String(trip._id), status: trip.status, acceptedAt: trip.acceptedAt?.toISOString() ?? null, arrivedAtPickupAt: trip.arrivedAtPickupAt?.toISOString() ?? null, patientPickedUpAt: trip.patientPickedUpAt?.toISOString() ?? null, arrivedAtHospitalAt: trip.arrivedAtHospitalAt?.toISOString() ?? null, completedAt: trip.completedAt?.toISOString() ?? null, statusHistory, trackingActive } : null,
    ambulance: accepted ? ambulance : null,
    location: accepted ? location : null,
    trackingActive: Boolean(trackingActive && accepted),
    routeTarget: trip ? routeTargetForTripStatus(trip.status) : 'PICKUP',
    serverTime: new Date().toISOString(),
  };
};

export const getTripTrackingSnapshot = async (identity: AuthenticatedIdentity, tripId: string) => {
  const trip = await TripModel.findById(idOf(tripId, 'trip')).select('emergencyRequestId').lean().exec();
  if (!trip) throw new AppError('NOT_FOUND', 'Trip not found.', 404);
  const snapshot = await getEmergencyTrackingSnapshot(identity, String(trip.emergencyRequestId));
  if (snapshot.trip?.id !== tripId) throw new AppError('NOT_FOUND', 'Trip tracking snapshot not found.', 404);
  return snapshot;
};

type RouteResult = Awaited<ReturnType<typeof calculateGoogleRoutes>>;
const routeCache = new Map<string, { expiresAt: number; promise: Promise<RouteResult> }>();
export const getTripNavigationRoute = async (identity: AuthenticatedIdentity, tripId: string): Promise<RouteResult> => {
  const snapshot = await getTripTrackingSnapshot(identity, tripId);
  if (!snapshot.trip || !snapshot.trackingActive || ['AT_HOSPITAL', 'COMPLETED', 'CANCELLED'].includes(snapshot.trip.status)) throw new AppError('TRIP_NOT_NAVIGATING', 'This trip does not have an active navigation route.', 409);
  if (!snapshot.location?.coordinatesAreLive || typeof snapshot.location.latitude !== 'number' || typeof snapshot.location.longitude !== 'number') throw new AppError('GPS_STALE', 'A fresh ambulance GPS fix is required before refreshing the route.', 409);
  const destination = snapshot.routeTarget === 'HOSPITAL' ? snapshot.hospital : snapshot.pickup;
  if (typeof destination.latitude !== 'number' || typeof destination.longitude !== 'number') throw new AppError('DESTINATION_COORDINATES_MISSING', 'Navigation destination coordinates are unavailable.', 409);
  const origin = { latitude: snapshot.location.latitude, longitude: snapshot.location.longitude };
  // Quantization and a 20-second TTL avoid a Google Routes request for every 3–5 second GPS fix.
  const key = [tripId, snapshot.routeTarget, origin.latitude.toFixed(3), origin.longitude.toFixed(3), destination.latitude.toFixed(5), destination.longitude.toFixed(5)].join(':');
  const now = Date.now();
  const cached = routeCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  const promise = calculateGoogleRoutes({ origin, destination: { latitude: destination.latitude, longitude: destination.longitude }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE' });
  routeCache.set(key, { expiresAt: now + 20_000, promise });
  while (routeCache.size > 200) routeCache.delete(routeCache.keys().next().value as string);
  try { return await promise; } catch (error) { routeCache.delete(key); throw error; }
};
