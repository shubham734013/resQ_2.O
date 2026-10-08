import { Types } from 'mongoose';
import { HospitalModel } from '../models/Hospital.js';
import { AppError } from '../utils/AppError.js';
import type { z } from 'zod';
import type { facilitySearchQuerySchema } from '../schemas/facility.js';

type FacilitySearchQuery = z.infer<typeof facilitySearchQuerySchema>;

type HospitalFacility = {
  _id: Types.ObjectId;
  name: string;
  hospitalType: string;
  services: string[];
  capabilities: string[];
  emergencyAvailability: string;
  verificationStatus: string;
  accountStatus: string;
  updatedAt: Date;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  location?: { type: 'Point'; coordinates: [number, number] };
};

const categoryFor = (hospital: Pick<HospitalFacility, 'hospitalType' | 'services' | 'capabilities'>): 'emergency' | 'trauma' | 'urgent_care' | 'pediatric' => {
  const text = [hospital.hospitalType, ...hospital.services, ...hospital.capabilities].join(' ').toLowerCase();
  if (text.includes('trauma')) return 'trauma';
  if (text.includes('pediatric') || text.includes('paediatric')) return 'pediatric';
  if (text.includes('urgent')) return 'urgent_care';
  return 'emergency';
};

export const hospitalToFacility = (hospital: HospitalFacility, distanceMeters?: unknown) => {
  const coordinates = hospital.location?.coordinates;
  const latitude = Array.isArray(coordinates) && typeof coordinates[1] === 'number' ? coordinates[1] : undefined;
  const longitude = Array.isArray(coordinates) && typeof coordinates[0] === 'number' ? coordinates[0] : undefined;
  const meters = typeof distanceMeters === 'number' && Number.isFinite(distanceMeters) ? distanceMeters : undefined;
  return {
    id: String(hospital._id),
    name: hospital.name,
    type: hospital.hospitalType,
    category: categoryFor(hospital),
    distance: meters === undefined ? '' : meters >= 1000 ? (meters / 1000).toFixed(1) + ' km' : Math.round(meters) + ' m',
    distanceMeters: meters,
    estimatedTime: '',
    emergencyAvailable: hospital.emergencyAvailability === 'AVAILABLE',
    verified: hospital.verificationStatus === 'VERIFIED',
    lastUpdated: hospital.updatedAt.toISOString(),
    latitude,
    longitude,
    address: [hospital.address, hospital.city, hospital.state, hospital.country].filter((value): value is string => Boolean(value)).join(', '),
    phone: hospital.phone ?? '',
    openStatus: hospital.emergencyAvailability === 'UNAVAILABLE' ? 'Emergency unavailable' : 'Emergency availability',
    isOpen: hospital.accountStatus === 'ACTIVE',
    isAvailable: hospital.emergencyAvailability !== 'UNAVAILABLE',
    capabilities: hospital.capabilities.filter((value): value is string => typeof value === 'string'),
  };
};

export const searchFacilities = async (query: FacilitySearchQuery) => {
  const baseFilter: Record<string, unknown> = {
    accountStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    location: { $exists: true },
  };
  if (query.emergencyOnly) baseFilter.emergencyAvailability = 'AVAILABLE';
  if (query.category !== 'all') {
    const categoryMap: Record<string, RegExp> = {
      emergency: /emergency|critical/i,
      trauma: /trauma/i,
      urgent_care: /urgent/i,
      pediatric: /pediatric|paediatric/i,
    };
    const categoryFilter = {
      $or: [
        { hospitalType: categoryMap[query.category] },
        { services: categoryMap[query.category] },
        { capabilities: categoryMap[query.category] },
      ],
    };
    baseFilter.$and = [categoryFilter];
  }
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const text = new RegExp(escaped, 'i');
    const textFilter = { $or: [{ name: text }, { address: text }, { city: text }, { state: text }, { services: text }, { capabilities: text }] };
    const existingAnd = Array.isArray(baseFilter.$and) ? baseFilter.$and : [];
    baseFilter.$and = [...existingAnd, textFilter];
  }
  if (query.latitude !== undefined && query.longitude !== undefined) {
    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [query.longitude, query.latitude] },
          key: 'location',
          distanceField: 'distanceMeters',
          spherical: true,
          maxDistance: query.radiusMeters,
          query: baseFilter,
        },
      },
      {
        $facet: {
          items: [{ $sort: { distanceMeters: 1, updatedAt: -1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];
    const [result] = await HospitalModel.aggregate<{ items: HospitalFacility[]; total: Array<{ count: number }> }>(pipeline).exec();
    const items = result?.items ?? [];
    const total = result?.total[0]?.count ?? 0;
    return {
      items: items.map((item) => hospitalToFacility(item, (item as unknown as { distanceMeters?: number }).distanceMeters)),
      pagination: { page: query.page, limit: query.limit, total, totalPages: total ? Math.ceil(total / query.limit) : 0 },
    };
  }
  const [items, total] = await Promise.all([
    HospitalModel.find(baseFilter).select('-passwordHash -email').sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    HospitalModel.countDocuments(baseFilter).exec(),
  ]);
  return {
    items: items.map((item) => hospitalToFacility(item as unknown as HospitalFacility)),
    pagination: { page: query.page, limit: query.limit, total, totalPages: total ? Math.ceil(total / query.limit) : 0 },
  };
};

export const getFacility = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new AppError('INVALID_ID', 'Invalid facility id', 400);
  const hospital = await HospitalModel.findOne({ _id: id, accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' }).select('-passwordHash -email').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Facility not found', 404);
  return hospitalToFacility(hospital as unknown as HospitalFacility);
};
