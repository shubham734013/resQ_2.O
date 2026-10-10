import { Types } from 'mongoose';
import { HospitalModel } from '../models/Hospital.js';
import { EmergencyRequestModel, type EmergencyRequestDocument, type HospitalEmergencyStatus } from '../models/EmergencyRequest.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { TripModel } from '../models/Trip.js';
import { AppError } from '../utils/AppError.js';
import type { HospitalProfile, HospitalPagination, HospitalEmergency, HospitalPatient, HospitalAmbulance } from '../types/hospital.js';
import type { z } from 'zod';
import type {
  hospitalAmbulanceListQuerySchema,
  hospitalEmergencyListQuerySchema,
  hospitalPatientListQuerySchema,
  hospitalProfileUpdateSchema,
  hospitalServicesUpdateSchema,
  hospitalCapabilitiesUpdateSchema,
  hospitalAvailabilityUpdateSchema,
  hospitalResourcesUpdateSchema,
} from '../schemas/hospital.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';

type ProfileInput = z.infer<typeof hospitalProfileUpdateSchema>;
type ServicesInput = z.infer<typeof hospitalServicesUpdateSchema>;
type CapabilitiesInput = z.infer<typeof hospitalCapabilitiesUpdateSchema>;
type AvailabilityInput = z.infer<typeof hospitalAvailabilityUpdateSchema>;
type ResourcesInput = z.infer<typeof hospitalResourcesUpdateSchema>;
type EmergencyQuery = z.infer<typeof hospitalEmergencyListQuerySchema>;
type PatientQuery = z.infer<typeof hospitalPatientListQuerySchema>;
type AmbulanceQuery = z.infer<typeof hospitalAmbulanceListQuerySchema>;

const escapeRegex = (value: string): string => value.replace(/[.*+?^()|[\]\\]/g, '\\$&');
export const hospitalOwnershipFilter = (hospitalId: string): { hospitalId: Types.ObjectId } => {
  if (!Types.ObjectId.isValid(hospitalId)) throw new AppError('INVALID_HOSPITAL_ID', 'Authenticated hospital identity is invalid', 401);
  return { hospitalId: new Types.ObjectId(hospitalId) };
};
const assertHospitalId = (hospitalId: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(hospitalId)) throw new AppError('INVALID_HOSPITAL_ID', 'Authenticated hospital identity is invalid', 401);
  return new Types.ObjectId(hospitalId);
};
const notFound = (message: string): never => { throw new AppError('NOT_FOUND', message, 404); };
const resourceObject = (value: unknown): Record<string, number> => {
  if (value instanceof Map) return Object.fromEntries([...value.entries()].filter(([, v]) => typeof v === 'number')) as Record<string, number>;
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
};

const profileOut = (document: Record<string, unknown>): HospitalProfile => ({
  id: String(document._id), name: String(document.name), registrationNumber: String(document.registrationNumber),
  email: String(document.email), phone: String(document.phone),
  address: typeof document.address === 'string' ? document.address : undefined,
  city: typeof document.city === 'string' ? document.city : undefined,
  state: typeof document.state === 'string' ? document.state : undefined,
  country: typeof document.country === 'string' ? document.country : undefined,
  latitude: Array.isArray((document.location as { coordinates?: unknown } | undefined)?.coordinates)
    ? Number((document.location as { coordinates: [number, number] }).coordinates[1])
    : (typeof document.latitude === 'number' ? document.latitude : undefined),
  longitude: Array.isArray((document.location as { coordinates?: unknown } | undefined)?.coordinates)
    ? Number((document.location as { coordinates: [number, number] }).coordinates[0])
    : (typeof document.longitude === 'number' ? document.longitude : undefined),
  hospitalType: String(document.hospitalType),
  services: Array.isArray(document.services) ? document.services.filter((v): v is string => typeof v === 'string') : [],
  capabilities: Array.isArray(document.capabilities) ? document.capabilities.filter((v): v is string => typeof v === 'string') : [],
  resourceSummary: resourceObject(document.resourceSummary),
  emergencyAvailability: String(document.emergencyAvailability),
  verificationStatus: document.verificationStatus as HospitalProfile['verificationStatus'],
  accountStatus: document.accountStatus as HospitalProfile['accountStatus'],
  publicContactInformation: typeof document.publicContactInformation === 'string' ? document.publicContactInformation : undefined,
  operationalDescription: typeof document.operationalDescription === 'string' ? document.operationalDescription : undefined,
  createdAt: document.createdAt as Date,
  updatedAt: document.updatedAt as Date,
});
const pagination = <T>(items: T[], total: number, page: number, limit: number): { items: T[]; pagination: HospitalPagination } => ({
  items, pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
});

export const getProfile = async (hospitalId: string): Promise<HospitalProfile> => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findById(id).select('-passwordHash').lean().exec();
  if (!hospital) notFound('Hospital profile not found');
  return profileOut(hospital as unknown as Record<string, unknown>);
};
export const updateProfile = async (hospitalId: string, input: ProfileInput): Promise<HospitalProfile> => {
  const id = assertHospitalId(hospitalId);
  const update: Record<string, unknown> = { ...input };
  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    update.location = { type: 'Point', coordinates: [input.longitude, input.latitude] };
    update.latitude = input.latitude;
    update.longitude = input.longitude;
  }
  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after', runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) notFound('Hospital profile not found');
  return profileOut(hospital as unknown as Record<string, unknown>);
};
export const getServices = async (hospitalId: string) => { const profile = await getProfile(hospitalId); return { services: profile.services, updatedAt: profile.updatedAt }; };
export const updateServices = async (hospitalId: string, input: ServicesInput) => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: { services: input.services } }, { returnDocument: 'after', runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital profile not found', 404);
  return { services: profileOut(hospital as unknown as Record<string, unknown>).services, updatedAt: hospital.updatedAt };
};
export const getCapabilities = async (hospitalId: string) => { const profile = await getProfile(hospitalId); return { capabilities: profile.capabilities, updatedAt: profile.updatedAt }; };
export const updateCapabilities = async (hospitalId: string, input: CapabilitiesInput) => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: { capabilities: input.capabilities } }, { returnDocument: 'after', runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital profile not found', 404);
  return { capabilities: profileOut(hospital as unknown as Record<string, unknown>).capabilities, updatedAt: hospital.updatedAt };
};
export const getAvailability = async (hospitalId: string) => { const profile = await getProfile(hospitalId); return { emergencyAvailability: profile.emergencyAvailability, updatedAt: profile.updatedAt }; };
export const updateAvailability = async (hospitalId: string, input: AvailabilityInput) => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: { emergencyAvailability: input.emergencyAvailability } }, { returnDocument: 'after', runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital profile not found', 404);
  return { emergencyAvailability: hospital.emergencyAvailability, updatedAt: hospital.updatedAt };
};
export const getResources = async (hospitalId: string) => { const profile = await getProfile(hospitalId); return { resourceSummary: profile.resourceSummary, updatedAt: profile.updatedAt }; };
export const updateResources = async (hospitalId: string, input: ResourcesInput) => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: { resourceSummary: input.resourceSummary } }, { returnDocument: 'after', runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital profile not found', 404);
  return { resourceSummary: profileOut(hospital as unknown as Record<string, unknown>).resourceSummary, updatedAt: hospital.updatedAt };
};

const emergencyOut = (x: Record<string, unknown>): HospitalEmergency => ({
  id: String(x._id), requestCode: String(x.requestCode), situationType: String(x.situationType),
  reportedAt: x.reportedAt as Date, location: typeof x.location === 'string' ? x.location : undefined,
  latitude: typeof x.latitude === 'number' ? x.latitude : undefined,
  longitude: typeof x.longitude === 'number' ? x.longitude : undefined,
  status: x.status as HospitalEmergencyStatus,
  ambulanceId: x.ambulanceId ? String(x.ambulanceId) : undefined,
  ambulanceProviderId: x.ambulanceProviderId ? String(x.ambulanceProviderId) : undefined,
  driverId: x.driverId ? String(x.driverId) : undefined,
  patientId: x.patientId ? String(x.patientId) : undefined,
  etaMinutes: typeof x.etaMinutes === 'number' ? x.etaMinutes : undefined,
  createdAt: x.createdAt as Date, updatedAt: x.updatedAt as Date,
});

export const listEmergencies = async (hospitalId: string, query: EmergencyQuery) => {
  const ownership = hospitalOwnershipFilter(hospitalId);
  const filter: Record<string, unknown> = { ...ownership };
  if (query.status) filter.status = query.status;
  if (query.situationType) filter.situationType = new RegExp(escapeRegex(query.situationType), 'i');
  if (query.search) {
    const search = escapeRegex(query.search);
    filter.$or = [{ requestCode: new RegExp(search, 'i') }, ...(Types.ObjectId.isValid(query.search) ? [{ patientId: new Types.ObjectId(query.search) }] : [])];
  }
  if (query.from || query.to) filter.reportedAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  const statusPriority = { $switch: { branches: [
    { case: { $eq: ['$status', 'RECEIVED'] }, then: 1 }, { case: { $eq: ['$status', 'REVIEWING'] }, then: 2 },
    { case: { $eq: ['$status', 'PREPARING'] }, then: 3 }, { case: { $eq: ['$status', 'AMBULANCE_COORDINATION'] }, then: 4 },
    { case: { $eq: ['$status', 'RESOLVED'] }, then: 5 }, { case: { $eq: ['$status', 'CANCELLED'] }, then: 6 },
  ], default: 99 } };
  const [result] = await EmergencyRequestModel.aggregate<{items: EmergencyRequestDocument[];total:Array<{count:number}>}>([
    { $match: filter },
    { $facet: {
      items: [
        { $addFields: { statusPriority } },
        { $sort: { statusPriority: 1, reportedAt: query.sortOrder === 'asc' ? 1 : -1, _id: 1 } },
        { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }, { $project: { statusPriority: 0 } },
      ],
      total: [{ $count: 'count' }],
    } },
  ]).exec();
  const items = result?.items ?? []; const total = result?.total[0]?.count ?? 0;
  return pagination(items.map((x) => emergencyOut(x as unknown as Record<string, unknown>)), total, query.page, query.limit);
};

export const getEmergencySummary = async (hospitalId: string) => {
  const grouped = await EmergencyRequestModel.aggregate<{ _id: HospitalEmergencyStatus; count: number }>([
    { $match: hospitalOwnershipFilter(hospitalId) }, { $group: { _id: '$status', count: { $sum: 1 } } },
  ]).exec();
  const summary: Record<HospitalEmergencyStatus, number> = { RECEIVED: 0, REVIEWING: 0, PREPARING: 0, AMBULANCE_COORDINATION: 0, RESOLVED: 0, CANCELLED: 0 };
  grouped.forEach((row) => { summary[row._id] = row.count; });
  return summary;
};

export const getEmergency = async (hospitalId: string, emergencyId: string) => {
  if (!Types.ObjectId.isValid(emergencyId)) throw new AppError('INVALID_ID', 'Invalid emergency id', 400);
  const emergency = await EmergencyRequestModel.findOne({ _id: emergencyId, ...hospitalOwnershipFilter(hospitalId) }).lean().exec();
  if (!emergency) notFound('Emergency request not found');
  return emergencyOut(emergency as unknown as Record<string, unknown>);
};

export const allowedEmergencyTransition: Record<HospitalEmergencyStatus, HospitalEmergencyStatus[]> = {
  RECEIVED: ['REVIEWING', 'CANCELLED'],
  REVIEWING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['AMBULANCE_COORDINATION', 'RESOLVED', 'CANCELLED'],
  AMBULANCE_COORDINATION: ['RESOLVED', 'CANCELLED'],
  RESOLVED: [], CANCELLED: [],
};

export const updateEmergencyStatus = async (
  hospitalId: string,
  emergencyId: string,
  status: HospitalEmergencyStatus,
  actor?: { id: string; role: 'HOSPITAL' | 'ADMIN' | 'SYSTEM' },
) => {
  const hospitalObjectId = assertHospitalId(hospitalId);
  if (!Types.ObjectId.isValid(emergencyId)) throw new AppError('INVALID_ID', 'Invalid emergency id', 400);
  const requestObjectId = new Types.ObjectId(emergencyId);
  const current = await EmergencyRequestModel.findOne({ _id: requestObjectId, hospitalId: hospitalObjectId }).select('status').lean().exec();
  if (!current) throw new AppError('NOT_FOUND', 'Emergency request not found', 404);
  if (current.status === status) return emergencyOut((await EmergencyRequestModel.findById(requestObjectId).lean().exec())! as unknown as Record<string, unknown>);
  const allowedNextStatuses = allowedEmergencyTransition[current.status];
  if (!allowedNextStatuses?.includes(status)) throw new AppError('INVALID_STATUS_TRANSITION', 'Emergency status transition is not allowed', 409);

  if (status === 'CANCELLED') {
    const activeTrip = await TripModel.findOne({ emergencyRequestId: requestObjectId, status: { $in: ['TO_PICKUP','AT_PICKUP','PATIENT_ONBOARD','TO_HOSPITAL','AT_HOSPITAL'] } }).lean().exec();
    if (activeTrip) throw new AppError('EMERGENCY_IN_TRANSPORT', 'The emergency cannot be cancelled after transport has started', 409);
  }
  if (status === 'RESOLVED') {
    const activeTrip = await TripModel.findOne({ emergencyRequestId: requestObjectId, status: { $in: ['ASSIGNED','ACCEPTED','TO_PICKUP','AT_PICKUP','PATIENT_ONBOARD','TO_HOSPITAL','AT_HOSPITAL'] } }).lean().exec();
    if (activeTrip) throw new AppError('TRIP_NOT_COMPLETE', 'The emergency cannot be resolved while an active trip exists', 409);
  }

  const now = new Date();
  const actorId = actor?.id && Types.ObjectId.isValid(actor.id) ? new Types.ObjectId(actor.id) : undefined;
  const actorRole = actor?.role ?? 'SYSTEM';
  const updated = await EmergencyRequestModel.findOneAndUpdate(
    { _id: requestObjectId, hospitalId: hospitalObjectId, status: current.status },
    { $set: { status }, $push: { statusHistory: { status, changedAt: now, previousStatus: current.status, actorId, actorRole } } },
    { returnDocument: 'after', runValidators: true },
  ).lean().exec();
  if (!updated) throw new AppError('STALE_EMERGENCY_UPDATE', 'Emergency request changed before this action could be applied', 409);
  return emergencyOut(updated as unknown as Record<string, unknown>);
};

const patientOut = (x: Record<string, unknown>): HospitalPatient => ({
  id: String(x._id), caseId: String(x.caseId), emergencyId: x.emergencyId ? String(x.emergencyId) : undefined,
  ambulanceId: x.ambulanceId ? String(x.ambulanceId) : undefined, coordinationStatus: x.coordinationStatus as HospitalPatient['coordinationStatus'],
  emergencyType: String(x.emergencyType), etaMinutes: typeof x.etaMinutes === 'number' ? x.etaMinutes : undefined, receivedAt: x.receivedAt as Date, updatedAt: x.updatedAt as Date,
});

export const listPatients = async (hospitalId: string, query: PatientQuery) => {
  const filter: Record<string, unknown> = { ...hospitalOwnershipFilter(hospitalId) };
  if (query.status) filter.coordinationStatus = query.status;
  if (query.from || query.to) filter.receivedAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  const [items, total] = await Promise.all([
    HospitalPatientModel.find(filter).sort({ receivedAt: query.sortOrder === 'asc' ? 1 : -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    HospitalPatientModel.countDocuments(filter).exec(),
  ]);
  return pagination(items.map((x) => patientOut(x as unknown as Record<string, unknown>)), total, query.page, query.limit);
};

export const getPatient = async (hospitalId: string, patientId: string) => {
  const filter = hospitalOwnershipFilter(hospitalId);
  if (!Types.ObjectId.isValid(patientId)) throw new AppError('INVALID_ID', 'Invalid patient id', 400);
  const x = await HospitalPatientModel.findOne({ _id: patientId, ...filter }).lean().exec();
  if (!x) notFound('Hospital patient case not found');
  return patientOut(x as unknown as Record<string, unknown>);
};

export const listAmbulances = async (hospitalId: string, query: AmbulanceQuery) => {
  assertHospitalId(hospitalId);
  const filter: Record<string, unknown> = { accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' };
  if (query.status) filter.currentStatus = query.status;
  const [items, total] = await Promise.all([
    AmbulanceModel.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    AmbulanceModel.countDocuments(filter).exec(),
  ]);
  const drivers = await AmbulanceDriverModel.find({ assignedAmbulanceId: { $in: items.map((x) => x._id) } }).select('fullName phone availabilityStatus').lean().exec();
  const driverMap = new Map(drivers.map((x) => [String(x.assignedAmbulanceId), x]));
  return pagination(items.map((x) => ({
    id: String(x._id),
    registrationNumber: x.registrationNumber,
    vehicleNumber: x.vehicleNumber,
    ambulanceType: x.ambulanceType,
    capabilities: x.capabilities,
    currentStatus: x.currentStatus,
    currentLatitude: x.currentLatitude,
    currentLongitude: x.currentLongitude,
    assignedDriverId: driverMap.get(String(x._id)) ? String(driverMap.get(String(x._id))!._id) : undefined,
    assignedDriverName: driverMap.get(String(x._id))?.fullName,
    updatedAt: x.updatedAt,
  }) as HospitalAmbulance), total, query.page, query.limit);
};
export const getAmbulance = async (hospitalId: string, ambulanceId: string) => {
  assertHospitalId(hospitalId);
  if (!Types.ObjectId.isValid(ambulanceId)) throw new AppError('INVALID_ID', 'Invalid ambulance id', 400);
  const ambulance = await AmbulanceModel.findOne({
    _id: ambulanceId,
    accountStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
  }).lean().exec();
  if (!ambulance) throw new AppError('NOT_FOUND', 'Ambulance not found', 404);
  const driver = await AmbulanceDriverModel.findOne({ assignedAmbulanceId: ambulance._id })
    .select('fullName phone availabilityStatus')
    .lean().exec();
  return {
    id: String(ambulance._id),
    registrationNumber: ambulance.registrationNumber,
    vehicleNumber: ambulance.vehicleNumber,
    ambulanceType: ambulance.ambulanceType,
    capabilities: ambulance.capabilities,
    currentStatus: ambulance.currentStatus,
    currentLatitude: ambulance.currentLatitude,
    currentLongitude: ambulance.currentLongitude,
    assignedDriverId: driver ? String(driver._id) : undefined,
    assignedDriverName: driver?.fullName,
    assignedDriverPhone: driver?.phone,
    assignedDriverStatus: driver?.availabilityStatus,
    updatedAt: ambulance.updatedAt,
  };
};
