import { Types } from 'mongoose';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AppError } from '../utils/AppError.js';
import type { LocationUpdateInput } from '../schemas/location.js';
import { getLocationFreshness } from '../schemas/location.js';

export const updateDriverAmbulanceLocation = async (driverId: string, input: LocationUpdateInput) => {
  if (!Types.ObjectId.isValid(driverId)) throw new AppError('INVALID_ID', 'Invalid driver id', 400);
  const driver = await AmbulanceDriverModel.findById(driverId).lean().exec();
  if (!driver) throw new AppError('NOT_FOUND', 'Driver not found', 404);
  if (!driver.assignedAmbulanceId) throw new AppError('DRIVER_AMBULANCE_REQUIRED', 'Driver has no assigned ambulance', 409);

  const ambulance = await AmbulanceModel.findOneAndUpdate(
    {
      _id: driver.assignedAmbulanceId,
      providerId: driver.providerId,
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
    {
      $set: {
        currentLatitude: input.latitude,
        currentLongitude: input.longitude,
        location: { type: 'Point', coordinates: [input.longitude, input.latitude] },
        locationUpdatedAt: new Date(input.timestamp),
      },
    },
    { returnDocument: 'after' },
  ).lean().exec();

  if (!ambulance) throw new AppError('AMBULANCE_NOT_OPERATIONAL', 'Assigned ambulance is not active and verified', 409);
  return {
    ambulanceId: String(ambulance._id),
    latitude: ambulance.currentLatitude,
    longitude: ambulance.currentLongitude,
    updatedAt: ambulance.locationUpdatedAt,
    freshness: getLocationFreshness(ambulance.locationUpdatedAt),
    accuracyMeters: input.accuracy,
  };
};