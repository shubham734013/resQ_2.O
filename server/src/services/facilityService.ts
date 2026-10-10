import { Types, type PipelineStage } from 'mongoose';
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

type Category =
  | 'emergency'
  | 'trauma'
  | 'urgent_care'
  | 'pediatric'
  | 'cardiology'
  | 'neurology'
  | 'orthopaedics'
  | 'maternity'
  | 'multispeciality'
  | 'general';

const categoryFor = (hospital: Pick<HospitalFacility, 'hospitalType' | 'services' | 'capabilities'>): Category => {
  const text = [hospital.hospitalType, ...hospital.services, ...hospital.capabilities].join(' ').toLowerCase();
  if (text.includes('trauma')) return 'trauma';
  if (text.includes('cardio') || text.includes('heart')) return 'cardiology';
  if (text.includes('neuro') || text.includes('brain') || text.includes('spine')) return 'neurology';
  if (text.includes('ortho') || text.includes('bone') || text.includes('joint')) return 'orthopaedics';
  if (text.includes('pediatric') || text.includes('paediatric') || text.includes('child')) return 'pediatric';
  if (text.includes('maternity') || text.includes('gynec') || text.includes('obstetric')) return 'maternity';
  if (text.includes('multi')) return 'multispeciality';
  if (text.includes('urgent')) return 'urgent_care';
  if (text.includes('emergency') || text.includes('critical')) return 'emergency';
  return 'general';
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
  };
  const andFilters: Record<string, unknown>[] = [];
  if (query.emergencyOnly) baseFilter.emergencyAvailability = 'AVAILABLE';
  if (query.category !== 'all') {
    const categoryMap: Record<string, RegExp> = {
      emergency: /emergency|critical/i,
      trauma: /trauma/i,
      urgent_care: /urgent/i,
      pediatric: /pediatric|paediatric|child/i,
      cardiology: /cardio|heart/i,
      neurology: /neuro|brain|spine/i,
      orthopaedics: /ortho|bone|joint/i,
      maternity: /maternity|obgyn|gynec|obstetric/i,
      multispeciality: /multi/i,
      general: /general/i,
    };
    const categoryRegex = categoryMap[query.category];
    if (categoryRegex) andFilters.push({ $or: [{ hospitalType: categoryRegex }, { services: categoryRegex }, { capabilities: categoryRegex }] });
  }
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const text = new RegExp(escaped, 'i');
    andFilters.push({ $or: [{ name: text }, { address: text }, { city: text }, { state: text }, { services: text }, { capabilities: text }] });
  }
  if (andFilters.length) baseFilter.$and = andFilters;

  if (query.latitude !== undefined && query.longitude !== undefined) {
    const near: { type: 'Point'; coordinates: [number, number] } = {
      type: 'Point',
      coordinates: [query.longitude, query.latitude],
    };
    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near,
          key: 'location',
          distanceField: 'distanceMeters',
          spherical: true,
          maxDistance: query.radiusMeters,
          query: { ...baseFilter, location: { $exists: true } },
        },
      },
      {
        $facet: {
          items: [{ $sort: { distanceMeters: 1, updatedAt: -1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];
    const [result] = await HospitalModel.aggregate<Record<string, unknown>>(pipeline).exec();
    const items = Array.isArray(result?.items) ? result.items as HospitalFacility[] : [];
    const totalBlock = Array.isArray(result?.total) ? result.total as Array<{ count?: number }> : [];
    const total = typeof totalBlock[0]?.count === 'number' ? totalBlock[0].count : 0;
    return {
      items: items.map((item) => hospitalToFacility(item, (item as HospitalFacility & { distanceMeters?: number }).distanceMeters)),
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
