import { Types } from 'mongoose';
import { HospitalModel } from '../models/Hospital.js';
import { AppError } from '../utils/AppError.js';
import type { z } from 'zod';
import type { facilitySearchQuerySchema } from '../schemas/facility.js';

type FacilitySearchQuery = z.infer<typeof facilitySearchQuerySchema>;

const categoryFor = (hospital: { hospitalType: string; services: string[]; capabilities: string[] }): 'emergency' | 'trauma' | 'urgent_care' | 'pediatric' => {
  const text = [hospital.hospitalType, ...hospital.services, ...hospital.capabilities].join(' ').toLowerCase();
  if (text.includes('trauma')) return 'trauma';
  if (text.includes('pediatric') || text.includes('paediatric')) return 'pediatric';
  if (text.includes('urgent')) return 'urgent_care';
  return 'emergency';
};

const toFacility = (hospital: Record<string, unknown>) => {
  const location = hospital.location as { coordinates?: [number, number] } | undefined;
  const latitude = location?.coordinates?.[1];
  const longitude = location?.coordinates?.[0];
  return {
    id: String(hospital._id),
    name: String(hospital.name),
    type: String(hospital.hospitalType),
    category: categoryFor(hospital as { hospitalType: string; services: string[]; capabilities: string[] }),
    distance: '',
    distanceMeters: 0,
    estimatedTime: '',
    emergencyAvailable: hospital.emergencyAvailability === 'AVAILABLE',
    verified: hospital.verificationStatus === 'VERIFIED',
    lastUpdated: new Date(String(hospital.updatedAt)).toISOString(),
    latitude: typeof latitude === 'number' ? latitude : 0,
    longitude: typeof longitude === 'number' ? longitude : 0,
    address: [hospital.address, hospital.city, hospital.state, hospital.country].filter((value): value is string => typeof value === 'string' && value.length > 0).join(', '),
    phone: String(hospital.phone ?? ''),
    openStatus: hospital.emergencyAvailability === 'UNAVAILABLE' ? 'Emergency unavailable' : 'Emergency services available',
    isOpen: hospital.accountStatus === 'ACTIVE',
    isAvailable: hospital.emergencyAvailability !== 'UNAVAILABLE',
    capabilities: Array.isArray(hospital.capabilities) ? hospital.capabilities.filter((value): value is string => typeof value === 'string') : [],
  };
};

export const searchFacilities = async (query: FacilitySearchQuery) => {
  const filter: Record<string, unknown> = { accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED', location: { $exists: true } };
  if (query.emergencyOnly) filter.emergencyAvailability = 'AVAILABLE';
  if (query.category !== 'all') {
    const categoryMap: Record<string, RegExp> = {
      emergency: /emergency|critical/i,
      trauma: /trauma/i,
      urgent_care: /urgent/i,
      pediatric: /pediatric|paediatric/i,
    };
    filter.$or = [{ hospitalType: categoryMap[query.category] }, { services: categoryMap[query.category] }, { capabilities: categoryMap[query.category] }];
  }
  if (query.q) {
    const text = new RegExp(query.q.replace(/[.*+?^()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [{ $or: [{ name: text }, { address: text }, { city: text }, { state: text }, { services: text }, { capabilities: text }] }];
  }

  const [items, total] = await Promise.all([
    HospitalModel.find(filter).select('-passwordHash -email').sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    HospitalModel.countDocuments(filter).exec(),
  ]);

  return { items: items.map((item) => toFacility(item as unknown as Record<string, unknown>)), pagination: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) } };
};

export const getFacility = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new AppError('INVALID_ID', 'Invalid facility id', 400);
  const hospital = await HospitalModel.findOne({ _id: id, accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' }).select('-passwordHash -email').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Facility not found', 404);
  return toFacility(hospital as unknown as Record<string, unknown>);
};