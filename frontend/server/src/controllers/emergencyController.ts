import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/emergencyService.js';
import { AppError } from '../utils/AppError.js';

const citizenId = (req: Request) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth || auth.role !== 'USER') throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  return auth.id;
};
const callerId = (req: Request) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  return auth.id;
};
const paramId = (req: Request): string => {
  const value = req.params.id;
  if (typeof value !== 'string') throw new Error('Invalid emergency id');
  return value;
};
const query = <T>(res: Response) => res.locals.validatedQuery as T;

export const createEmergency = async (req: Request, res: Response) => {
  const key = req.header('Idempotency-Key')?.trim();
  if (!key || key.length < 16 || key.length > 128) throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'Retry-safe SOS submission requires an Idempotency-Key header', 400);
  sendSuccess(res, await service.createEmergencyRequest(citizenId(req), (res.locals.validatedBody ?? req.body), key), 201);
};
export const discoverEmergencyHospitals = async (req: Request, res: Response) => sendSuccess(res, await service.discoverEmergencyHospitals(callerId(req), query(res)));
export const listEmergencies = async (req: Request, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  if (auth.role !== 'USER' && auth.role !== 'ADMIN') {
    return sendSuccess(res, {
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  }
  sendSuccess(res, await service.listUserEmergencyRequests(auth.id, query(res)));
};
export const getEmergency = async (req: Request, res: Response) => sendSuccess(res, await service.getUserEmergencyRequest(citizenId(req), paramId(req)));
export const cancelEmergency = async (req: Request, res: Response) => sendSuccess(res, await service.cancelUserEmergencyRequest(citizenId(req), paramId(req)));
