import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as dispatch from '../services/dispatchService.js';
import type { DispatchJobStatus } from '../models/DispatchJob.js';

const actorId = (req: Request, role: 'ADMIN' | 'AMBULANCE_DRIVER') => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth || auth.role !== role) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  return auth.id;
};
const paramId = (req: Request) => {
  const value = req.params.id;
  if (typeof value !== 'string') throw new AppError('INVALID_ID', 'Invalid dispatch job ID', 400);
  return value;
};

export const driverOffers = async (req: Request, res: Response) => sendSuccess(res, await dispatch.listDriverDispatchOffers(actorId(req, 'AMBULANCE_DRIVER')));
export const driverAcceptOffer = async (req: Request, res: Response) => sendSuccess(res, await dispatch.acceptDispatchOffer(actorId(req, 'AMBULANCE_DRIVER'), paramId(req)));
export const driverRejectOffer = async (req: Request, res: Response) => sendSuccess(res, await dispatch.rejectDispatchOffer(actorId(req, 'AMBULANCE_DRIVER'), paramId(req)));

const query = (res: Response) => res.locals.validatedQuery as { status?: DispatchJobStatus; limit: number };
export const adminDispatchJobs = async (_req: Request, res: Response) => sendSuccess(res, await dispatch.listDispatchJobs(query(res)));
export const adminRetryDispatch = async (req: Request, res: Response) => sendSuccess(res, await dispatch.retryDispatchJob(actorId(req, 'ADMIN'), paramId(req)));
export const adminManualAssignDispatch = async (req: Request, res: Response) => {
  const body = res.locals.validatedBody as { driverId: string };
  return sendSuccess(res, await dispatch.manualAssignDispatchJob(actorId(req, 'ADMIN'), paramId(req), body.driverId));
};
export const adminEscalateDispatch = async (req: Request, res: Response) => {
  const body = res.locals.validatedBody as { reason: string };
  return sendSuccess(res, await dispatch.escalateDispatchJob(actorId(req, 'ADMIN'), paramId(req), body.reason));
};
