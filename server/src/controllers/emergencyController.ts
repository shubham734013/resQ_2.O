import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/emergencyService.js';

const authUser = (req: Request): string => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth || auth.role !== 'USER') throw new Error('User authentication required');
  return auth.id;
};
const id = (req: Request): string => {
  const value = req.params.id;
  if (typeof value !== 'string') throw new Error('Invalid emergency id');
  return value;
};
const query = <T>(res: Response): T => res.locals.validatedQuery as T;

export const createEmergency = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await service.createEmergencyRequest(authUser(req), req.body), 201);
export const listEmergencies = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await service.listUserEmergencyRequests(authUser(req), query(res)));
export const getEmergency = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await service.getUserEmergencyRequest(authUser(req), id(req)));
export const cancelEmergency = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await service.cancelUserEmergencyRequest(authUser(req), id(req)));
