import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import type { z } from 'zod';
import type { nearbyQuerySchema } from '../schemas/maps.js';

type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

const point = (latitude: number, longitude: number) => ({
  type: 'Point' as const,
  coordinates: [longitude, latitude] as [number, number],
});

const escapeRegex = (value: string): string => value.replace(/[\\^$.*+?()[\\]{}|]/g, '\\const escapeRegex = (value: string): string => value.replace(/[.*+?^()|[\\]\\]/g, '\\$&');');

const pagination = <T>(items: T[], total: number, query: NearbyQuery) => ({
  items,
  pagination: {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  },
});

export const listNearbyFacilities = async (query: NearbyQuery) => {
  const center = point(query.latitude, query.longitude);
  const filter: Record<string, unknown> = {
    location: { $near: { $geometry: center, $maxDistance: query.radius } },
    accountStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
  };

  if (query.emergencyAvailability) filter.emergencyAvailability = query.emergencyAvailability;
  if (query.hospitalType) filter.hospitalType = new RegExp(escapeRegex(query.hospitalType), 'i');
  if (query.service) filter.services = new RegExp(escapeRegex(query.service), 'i');
  if (query.capability) filter.capabilities = new RegExp(escapeRegex(query.capability), 'i');

  const countFilter = {
    ...filter,
    location: {
      $geoWithin: {
        $centerSphere: [[query.longitude, query.latitude], query.radius / 6378137],
      },
    },
  };

  const [items, total] = await Promise.all([
    HospitalModel.find(filter)
      .select('name location verificationStatus emergencyAvailability capabilities updatedAt')
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    HospitalModel.countDocuments(countFilter).exec(),
  ]);

  return pagination(
    items.map((hospital) => ({
      id: String(hospital._id),
      name: hospital.name,
      latitude: hospital.location?.coordinates[1] ?? 0,
      longitude: hospital.location?.coordinates[0] ?? 0,
      verificationStatus: hospital.verificationStatus,
      emergencyAvailability: hospital.emergencyAvailability,
      capabilities: hospital.capabilities,
      updatedAt: hospital.updatedAt.toISOString(),
    })),
    total,
    query,
  );
};

export const listNearbyAmbulances = async (query: NearbyQuery) => {
  const center = point(query.latitude, query.longitude);
  const items = await AmbulanceModel.find({
    location: { $near: { $geometry: center, $maxDistance: query.radius } },
    currentStatus: 'AVAILABLE',
    accountStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
  })
    .select('location currentStatus locationUpdatedAt updatedAt')
    .limit(query.limit)
    .lean()
    .exec();

  return {
    items: items.map((ambulance) => ({
      id: String(ambulance._id),
      status: ambulance.currentStatus,
      latitude: ambulance.location?.coordinates[1] ?? 0,
      longitude: ambulance.location?.coordinates[0] ?? 0,
      updatedAt: (ambulance.locationUpdatedAt ?? ambulance.updatedAt).toISOString(),
    })),
    updatedAt: new Date().toISOString(),
  };
};