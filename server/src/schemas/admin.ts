import { z } from 'zod';
import { ACCOUNT_STATUSES, ROLES, VERIFICATION_STATUSES } from '../types/roles.js';
import { AMBULANCE_STATUSES } from '../models/Ambulance.js';
import { DRIVER_AVAILABILITY_STATUSES } from '../models/AmbulanceDriver.js';
import { HOSPITAL_EMERGENCY_STATUSES } from '../models/EmergencyRequest.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const pagination = { page:z.coerce.number().int().min(1).default(1), limit:z.coerce.number().int().min(1).max(100).default(20), sortOrder:z.enum(['asc','desc']).default('desc') };
const dateRange = { from:z.coerce.date().optional(), to:z.coerce.date().optional() };
const reportDateRangeSchema=z.object(dateRange).strict().superRefine((value,ctx)=>{
  if(value.from&&value.to&&value.from>value.to)ctx.addIssue({code:z.ZodIssueCode.custom,path:['from'],message:'from must be before to'});
  if(value.from&&value.to&&value.to.getTime()-value.from.getTime()>366*24*60*60*1000)ctx.addIssue({code:z.ZodIssueCode.custom,path:['to'],message:'date range cannot exceed 366 days'});
});
export const userListQuerySchema=z.object({search:z.string().trim().max(100).optional(),status:z.enum(ACCOUNT_STATUSES).optional(),role:z.enum(ROLES).optional(),city:z.string().trim().max(100).optional(),from:dateRange.from,to:dateRange.to,sortBy:z.enum(['createdAt','updatedAt','name','email','role','accountStatus']).default('createdAt'),...pagination}).strict().refine(v=>!v.from||!v.to||v.from<=v.to,{message:'from must be before to'});
export const hospitalListQuerySchema=z.object({search:z.string().trim().max(100).optional(),verification:z.enum(VERIFICATION_STATUSES).optional(),status:z.enum(ACCOUNT_STATUSES).optional(),city:z.string().trim().max(100).optional(),hospitalType:z.string().trim().max(100).optional(),sortBy:z.enum(['createdAt','updatedAt','name','city','verificationStatus','accountStatus']).default('createdAt'),...pagination}).strict();
export const providerListQuerySchema=z.object({search:z.string().trim().max(100).optional(),verification:z.enum(VERIFICATION_STATUSES).optional(),status:z.enum(ACCOUNT_STATUSES).optional(),city:z.string().trim().max(100).optional(),sortBy:z.enum(['createdAt','updatedAt','name','city','verificationStatus','accountStatus']).default('createdAt'),...pagination}).strict();
export const ambulanceListQuerySchema=z.object({search:z.string().trim().max(100).optional(),currentStatus:z.enum(AMBULANCE_STATUSES).optional(),verification:z.enum(VERIFICATION_STATUSES).optional(),status:z.enum(ACCOUNT_STATUSES).optional(),provider:objectId.optional(),sortBy:z.enum(['createdAt','updatedAt','registrationNumber','vehicleNumber','currentStatus','verificationStatus','accountStatus']).default('createdAt'),...pagination}).strict();
export const driverListQuerySchema=z.object({search:z.string().trim().max(100).optional(),verification:z.enum(VERIFICATION_STATUSES).optional(),status:z.enum(ACCOUNT_STATUSES).optional(),availability:z.enum(DRIVER_AVAILABILITY_STATUSES).optional(),provider:objectId.optional(),sortBy:z.enum(['createdAt','updatedAt','fullName','email','licenseVerificationStatus','availabilityStatus','accountStatus']).default('createdAt'),...pagination}).strict();
export const reportsQuerySchema=reportDateRangeSchema;
export const reportsExportQuerySchema=reportDateRangeSchema;
export const adminEmergencyListQuerySchema=z.object({
  search:z.string().trim().max(100).optional(), status:z.enum(HOSPITAL_EMERGENCY_STATUSES).optional(),
  hospital:objectId.optional(), provider:objectId.optional(), ambulance:objectId.optional(), driver:objectId.optional(),
  situation:z.string().trim().max(100).optional(), from:dateRange.from, to:dateRange.to, ...pagination
}).strict().refine(v=>!v.from||!v.to||v.from<=v.to,{path:['from'],message:'from must be before to'});
export const accountStatusSchema=z.object({status:z.enum(['ACTIVE','SUSPENDED','REJECTED'])}).strict();
export const verificationStatusSchema=z.object({verificationStatus:z.enum(VERIFICATION_STATUSES)}).strict();
