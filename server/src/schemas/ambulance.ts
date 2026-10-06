import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);
const date = z.string().datetime().transform((v) => new Date(v));

export const providerProfileUpdateSchema = z.object({ name:z.string().trim().min(2).max(100).optional(), phone:z.string().trim().min(7).max(20).optional(), address:z.string().trim().max(250).optional(), city:z.string().trim().max(100).optional(), state:z.string().trim().max(100).optional(), country:z.string().trim().max(100).optional(), latitude:lat.optional(), longitude:lng.optional(), serviceType:z.string().trim().min(2).max(80).optional() }).strict();
export const ambulanceCreateSchema = z.object({ registrationNumber:z.string().trim().min(2).max(50), vehicleNumber:z.string().trim().min(2).max(50), ambulanceType:z.string().trim().min(2).max(80), capabilities:z.array(z.string().trim().min(1).max(100)).max(50).default([]), currentLatitude:lat.optional(), currentLongitude:lng.optional(), serviceArea:z.string().trim().max(150).optional() }).strict();
export const ambulanceUpdateSchema = ambulanceCreateSchema.partial();
export const ambulanceStatusSchema = z.object({ status:z.enum(['AVAILABLE','BUSY','OFFLINE','MAINTENANCE']) }).strict();
export const driverCreateSchema = z.object({ fullName:z.string().trim().min(2).max(100), email:z.string().trim().email(), phone:z.string().trim().min(7).max(20), password:z.string().min(12).max(128), licenseNumber:z.string().trim().min(3).max(80), address:z.string().trim().max(250).optional(), city:z.string().trim().max(100).optional(), state:z.string().trim().max(100).optional(), country:z.string().trim().max(100).optional(), registeredLatitude:lat.optional(), registeredLongitude:lng.optional() }).strict();
export const driverUpdateSchema = driverCreateSchema.omit({password:true}).partial().extend({password:z.string().min(12).max(128).optional()}).strict();
export const assignmentSchema = z.object({ driverId:objectId }).strict();
export const driverStatusSchema = z.object({ status:z.enum(['ONLINE','OFFLINE','BUSY']) }).strict();
export const requestAssignSchema = z.object({ ambulanceId:objectId }).strict();
const commonQuery = z.object({ page, limit, search:z.string().trim().max(100).optional(), status:z.string().trim().max(50).optional(), ambulance:z.string().regex(/^[0-9a-fA-F]{24}$/).optional(), driver:z.string().regex(/^[0-9a-fA-F]{24}$/).optional(), from:date.optional(), to:date.optional(), sortOrder:z.enum(['asc','desc']).default('desc') }).strict();
export const providerAmbulanceQuerySchema = commonQuery;
export const providerDriverQuerySchema = commonQuery;
export const providerRequestQuerySchema = commonQuery;
export const providerTripQuerySchema = commonQuery;
export const driverRequestQuerySchema = commonQuery;
export const driverTripQuerySchema = commonQuery;
