import { Types } from 'mongoose';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { EmergencyRequestModel, type HospitalEmergencyStatus } from '../models/EmergencyRequest.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
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
  id: String(document._id),
  name: String(document.name),
  registrationNumber: String(document.registrationNumber),
  email: String(document.email),
  phone: String(document.phone),
  address: typeof document.address === 'string' ? document.address : undefined,
  city: typeof document.city === 'string' ? document.city : undefined,
  state: typeof document.state === 'string' ? document.state : undefined,
  country: typeof document.country === 'string' ? document.country : undefined,
  latitude: typeof document.latitude === 'number' ? document.latitude : undefined,
  longitude: typeof document.longitude === 'number' ? document.longitude : undefined,
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
  items,
  pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
});

export const getProfile = async (hospitalId: string): Promise<HospitalProfile> => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findById(id).select('-passwordHash').lean().exec();
  if (!hospital) notFound('Hospital profile not found');
  return profileOut(hospital as unknown as Record<string, unknown>);
};

export const updateProfile = async (hospitalId: string, input: ProfileInput): Promise<HospitalProfile> => {
  const id = assertHospitalId(hospitalId);
  const update: Record<string, unknown> = { ...input };\n  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {\n    update.location = { type: 'Point', coordinates: [input.longitude, input.latitude] };\n    delete update.latitude;\n    delete update.longitude;\n  }\n  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) notFound('Hospital profile not found');
  return profileOut(hospital as unknown as Record<string, unknown>);
};

export const getServices = async (hospitalId: string) => {
  const profile = await getProfile(hospitalId);
  return { services: profile.services, updatedAt: profile.updatedAt };
};

export const updateServices = async (hospitalId: string, input: ServicesInput) => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: { services: input.services } }, { new: true, runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital profile not found', 404);
  return { services: profileOut(hospital as unknown as Record<string, unknown>).services, updatedAt: hospital.updatedAt };
};

export const getCapabilities = async (hospitalId: string) => {
  const profile = await getProfile(hospitalId);
  return { capabilities: profile.capabilities, updatedAt: profile.updatedAt };
};

export const updateCapabilities = async (hospitalId: string, input: CapabilitiesInput) => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: { capabilities: input.capabilities } }, { new: true, runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital profile not found', 404);
  return { capabilities: profileOut(hospital as unknown as Record<string, unknown>).capabilities, updatedAt: hospital.updatedAt };
};

export const getAvailability = async (hospitalId: string) => {
  const profile = await getProfile(hospitalId);
  return { emergencyAvailability: profile.emergencyAvailability, updatedAt: profile.updatedAt };
};

export const updateAvailability = async (hospitalId: string, input: AvailabilityInput) => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: { emergencyAvailability: input.emergencyAvailability } }, { new: true, runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital profile not found', 404);
  return { emergencyAvailability: hospital.emergencyAvailability, updatedAt: hospital.updatedAt };
};

export const getResources = async (hospitalId: string) => {
  const profile = await getProfile(hospitalId);
  return { resourceSummary: profile.resourceSummary, updatedAt: profile.updatedAt };
};

export const updateResources = async (hospitalId: string, input: ResourcesInput) => {
  const id = assertHospitalId(hospitalId);
  const hospital = await HospitalModel.findByIdAndUpdate(id, { $set: { resourceSummary: input.resourceSummary } }, { new: true, runValidators: true }).select('-passwordHash').lean().exec();
  if (!hospital) throw new AppError('NOT_FOUND', 'Hospital profile not found', 404);
  return { resourceSummary: profileOut(hospital as unknown as Record<string, unknown>).resourceSummary, updatedAt: hospital.updatedAt };
};

const emergencyOut = (x: Record<string, unknown>): HospitalEmergency => ({
  id: String(x._id),
  requestCode: String(x.requestCode),
  situationType: String(x.situationType),
  reportedAt: x.reportedAt as Date,
  location: typeof x.location === 'string' ? x.location : undefined,
  latitude: typeof x.latitude === 'number' ? x.latitude : undefined,
  longitude: typeof x.longitude === 'number' ? x.longitude : undefined,
  status: x.status as HospitalEmergencyStatus,
  ambulanceId: x.ambulanceId ? String(x.ambulanceId) : undefined,
  patientId: x.patientId ? String(x.patientId) : undefined,
  etaMinutes: typeof x.etaMinutes === 'number' ? x.etaMinutes : undefined,
  updatedAt: x.updatedAt as Date,
});

export const listEmergencies = async (hospitalId: string, query: EmergencyQuery) => {
  hospitalOwnershipFilter(hospitalId);
  const filter: Record<string, unknown> = { ...hospitalOwnershipFilter(hospitalId) };
  if (query.status) filter.status = query.status;
  if (query.situationType) filter.situationType = new RegExp(escapeRegex(query.situationType), 'i');
  if (query.from || query.to) filter.reportedAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };

  const [items, total] = await Promise.all([
    EmergencyRequestModel.find(filter).sort({ reportedAt: query.sortOrder === 'asc' ? 1 : -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    EmergencyRequestModel.countDocuments(filter).exec(),
  ]);

  return pagination(items.map((x) => emergencyOut(x as unknown as Record<string, unknown>)), total, query.page, query.limit);
};

export const getEmergency = async (hospitalId: string, emergencyId: string) => {
  hospitalOwnershipFilter(hospitalId);
  if (!Types.ObjectId.isValid(emergencyId)) throw new AppError('INVALID_ID', 'Invalid emergency id', 400);
  const emergency = await EmergencyRequestModel.findOne({ _id: emergencyId, ...hospitalOwnershipFilter(hospitalId) }).lean().exec();
  if (!emergency) notFound('Emergency request not found');
  return emergencyOut(emergency as unknown as Record<string, unknown>);
};

const allowedEmergencyTransition: Record<HospitalEmergencyStatus, HospitalEmergencyStatus[]> = {
  RECEIVED: ['REVIEWING', 'CANCELLED'],
  REVIEWING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['AMBULANCE_COORDINATION', 'RESOLVED', 'CANCELLED'],
  AMBULANCE_COORDINATION: ['RESOLVED', 'CANCELLED'],
  RESOLVED: [],
  CANCELLED: [],
};

export const updateEmergencyStatus = async (hospitalId: string, emergencyId: string, status: HospitalEmergencyStatus) => {
  assertHospitalId(hospitalId);
  if (!Types.ObjectId.isValid(emergencyId)) throw new AppError('INVALID_ID', 'Invalid emergency id', 400);
  const emergency = await EmergencyRequestModel.findOne({ _id: emergencyId, ...hospitalOwnershipFilter(hospitalId) }).exec();
  if (!emergency) throw new AppError('NOT_FOUND', 'Emergency request not found', 404);
  if (emergency.status !== status && !allowedEmergencyTransition[emergency.status].includes(status)) {
    throw new AppError('INVALID_STATUS_TRANSITION', 'Emergency status transition is not allowed', 409);
  }
  emergency.status = status;
  await emergency.save();
  return emergencyOut(emergency.toObject() as unknown as Record<string, unknown>);
};

const patientOut = (x: Record<string, unknown>): HospitalPatient => ({
  id: String(x._id),
  caseId: String(x.caseId),
  emergencyId: x.emergencyId ? String(x.emergencyId) : undefined,
  ambulanceId: x.ambulanceId ? String(x.ambulanceId) : undefined,
  coordinationStatus: x.coordinationStatus as HospitalPatient['coordinationStatus'],
  emergencyType: String(x.emergencyType),
  etaMinutes: typeof x.etaMinutes === 'number' ? x.etaMinutes : undefined,
  receivedAt: x.receivedAt as Date,
  updatedAt: x.updatedAt as Date,
});

export const listPatients = async (hospitalId: string, query: PatientQuery) => {
  assertHospitalId(hospitalId);
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
  hospitalOwnershipFilter(hospitalId);
  if (!Types.ObjectId.isValid(patientId)) throw new AppError('INVALID_ID', 'Invalid patient id', 400);
  const patient = await HospitalPatientModel.findOne({ _id: patientId, ...hospitalOwnershipFilter(hospitalId) }).lean().exec();
  if (!patient) notFound('Patient coordination record not found');
  return patientOut(patient as unknown as Record<string, unknown>);
};

const ambulanceOut = (x: Record<string, unknown>, provider: Record<string, unknown> | null, driver: Record<string, unknown> | null, emergencyId?: string, etaMinutes?: number): HospitalAmbulance => ({
  id: String(x._id),
  registrationNumber: String(x.registrationNumber),
  vehicleNumber: String(x.vehicleNumber),
  ambulanceType: String(x.ambulanceType),
  capabilities: Array.isArray(x.capabilities) ? x.capabilities.filter((v): v is string => typeof v === 'string') : [],
  currentStatus: String(x.currentStatus),
  currentLatitude: typeof x.currentLatitude === 'number' ? x.currentLatitude : undefined,
  currentLongitude: typeof x.currentLongitude === 'number' ? x.currentLongitude : undefined,
  serviceArea: typeof x.serviceArea === 'string' ? x.serviceArea : undefined,
  provider: provider ? { id: String(provider._id), name: typeof provider.name === 'string' ? provider.name : undefined, registrationNumber: typeof provider.registrationNumber === 'string' ? provider.registrationNumber : undefined } : null,
  driver: driver ? { id: String(driver._id), name: typeof driver.fullName === 'string' ? driver.fullName : undefined, licenseNumber: typeof driver.licenseNumber === 'string' ? driver.licenseNumber : undefined } : null,
  ...(emergencyId ? { emergencyId } : {}),
  ...(etaMinutes !== undefined ? { etaMinutes } : {}),
  updatedAt: x.updatedAt as Date,
});

export const listAmbulances = async (hospitalId: string, query: AmbulanceQuery) => {
  hospitalOwnershipFilter(hospitalId);
  const emergencies = await EmergencyRequestModel.find({ ...hospitalOwnershipFilter(hospitalId), ambulanceId: { $exists: true } }).select('ambulanceId etaMinutes _id').lean().exec();
  const ambulanceIds = emergencies.map((x) => x.ambulanceId).filter((x): x is Types.ObjectId => x instanceof Types.ObjectId);
  if (!ambulanceIds.length) return pagination([], 0, query.page, query.limit);

  const filter: Record<string, unknown> = { _id: { $in: ambulanceIds } };
  if (query.status) filter.currentStatus = query.status;
  if (query.provider) filter.providerId = new Types.ObjectId(query.provider);

  const [items, total] = await Promise.all([
    AmbulanceModel.find(filter).sort({ updatedAt: query.sortOrder === 'asc' ? 1 : -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    AmbulanceModel.countDocuments(filter).exec(),
  ]);

  const ids = items.map((x) => x._id);
  const [providers, drivers, relatedEmergencies] = await Promise.all([
    ids.length ? AmbulanceProviderModel.find({ _id: { $in: items.map((x) => x.providerId) } }).select('name registrationNumber').lean().exec() : Promise.resolve([]),
    ids.length ? AmbulanceDriverModel.find({ assignedAmbulanceId: { $in: ids } }).select('fullName licenseNumber').lean().exec() : Promise.resolve([]),
    EmergencyRequestModel.find({ ...hospitalOwnershipFilter(hospitalId), ambulanceId: { $in: ids } }).select('ambulanceId _id etaMinutes').sort({ reportedAt: -1 }).lean().exec(),
  ]);
  const providerMap = new Map(providers.map((x) => [String(x._id), x as unknown as Record<string, unknown>]));
  const driverMap = new Map(drivers.map((x) => [String(x.assignedAmbulanceId), x as unknown as Record<string, unknown>]));
  const emergencyMap = new Map(relatedEmergencies.map((x) => [String(x.ambulanceId), x]));
  return pagination(items.map((x) => {
    const emergency = emergencyMap.get(String(x._id));
    return ambulanceOut(x as unknown as Record<string, unknown>, providerMap.get(String(x.providerId)) ?? null, driverMap.get(String(x._id)) ?? null, emergency?._id ? String(emergency._id) : undefined, emergency?.etaMinutes);
  }), total, query.page, query.limit);
};

export const getAmbulance = async (hospitalId: string, ambulanceId: string) => {
  hospitalOwnershipFilter(hospitalId);
  if (!Types.ObjectId.isValid(ambulanceId)) throw new AppError('INVALID_ID', 'Invalid ambulance id', 400);
  const emergency = await EmergencyRequestModel.findOne({ ...hospitalOwnershipFilter(hospitalId), ambulanceId }).sort({ reportedAt: -1 }).lean().exec();
  if (!emergency) throw new AppError('NOT_FOUND', 'Ambulance is not associated with this hospital', 404);
  const ambulance = await AmbulanceModel.findById(ambulanceId).lean().exec();
  if (!ambulance) throw new AppError('NOT_FOUND', 'Ambulance not found', 404);
  const [provider, driver] = await Promise.all([
    AmbulanceProviderModel.findById(ambulance.providerId).select('name registrationNumber').lean().exec(),
    AmbulanceDriverModel.findOne({ assignedAmbulanceId: ambulance._id }).select('fullName licenseNumber').lean().exec(),
  ]);
  return ambulanceOut(ambulance as unknown as Record<string, unknown>, provider as unknown as Record<string, unknown> | null, driver as unknown as Record<string, unknown> | null, String(emergency._id), emergency.etaMinutes);
};
