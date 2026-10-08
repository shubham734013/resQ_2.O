import { z } from 'zod';

const objectId=z.string().regex(/^[0-9a-fA-F]{24}$/,'Invalid hospital id');
const lat=z.number().min(-90).max(90);
const lng=z.number().min(-180).max(180);

export const createEmergencyRequestSchema=z.object({
  hospitalId:objectId,
  situationType:z.string().trim().min(2).max(100),
  location:z.string().trim().max(300).optional(),
  latitude:lat.optional(),
  longitude:lng.optional(),
}).strict();

export const emergencyListQuerySchema=z.object({
  page:z.coerce.number().int().min(1).default(1),
  limit:z.coerce.number().int().min(1).max(100).default(20),
  status:z.enum(['RECEIVED','REVIEWING','PREPARING','AMBULANCE_COORDINATION','RESOLVED','CANCELLED']).optional(),
  from:z.string().datetime().transform((v)=>new Date(v)).optional(),
  to:z.string().datetime().transform((v)=>new Date(v)).optional(),
  search:z.string().trim().max(100).optional(),
}).strict();
