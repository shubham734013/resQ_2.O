import { Types } from 'mongoose';
import type { AuthenticatedIdentity } from '../types/auth.js';

export const canAccessTrackingSnapshot = (
  identity: AuthenticatedIdentity,
  emergency: { _id: Types.ObjectId; userId: Types.ObjectId; hospitalId: Types.ObjectId; ambulanceProviderId?: Types.ObjectId },
  trip: { driverId?: Types.ObjectId; providerId: Types.ObjectId; destinationHospitalId?: Types.ObjectId } | null,
): boolean => {
  if (identity.role === 'ADMIN') return true;
  if (identity.role === 'USER') return String(emergency.userId) === identity.id;
  if (identity.role === 'HOSPITAL') return String(emergency.hospitalId) === identity.id && (!trip?.destinationHospitalId || String(trip.destinationHospitalId) === identity.id);
  if (identity.role === 'AMBULANCE_DRIVER') return Boolean(trip?.driverId && String(trip.driverId) === identity.id);
  if (identity.role === 'AMBULANCE_PROVIDER') return trip ? String(trip.providerId) === identity.id : Boolean(emergency.ambulanceProviderId && String(emergency.ambulanceProviderId) === identity.id);
  return false;
};
