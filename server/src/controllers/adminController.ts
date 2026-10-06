import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import * as s from '../services/adminService.js';

const getId = (req: Request): string => {
  const id = req.params.id;
  if (typeof id !== 'string') throw new Error('Invalid resource id');
  return id;
};

const getValidatedQuery = <T>(res: Response): T => res.locals.validatedQuery as T;

export const overviewController = async (_req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.getOverview());

export const usersController = async (_req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.listUsers(getValidatedQuery(res)));

export const userController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.getUser(getId(req)));

export const userStatusController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.updateUserStatus(getId(req), (req.body as { status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' }).status));

export const hospitalsController = async (_req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.listHospitals(getValidatedQuery(res)));

export const hospitalController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.getHospital(getId(req)));

export const hospitalVerificationController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.updateHospitalVerification(getId(req), (req.body as { verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' }).verificationStatus));

export const hospitalStatusController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.updateHospitalStatus(getId(req), (req.body as { status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' }).status));

export const providersController = async (_req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.listProviders(getValidatedQuery(res)));

export const providerController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.getProvider(getId(req)));

export const providerVerificationController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.updateProviderVerification(getId(req), (req.body as { verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' }).verificationStatus));

export const providerStatusController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.updateProviderStatus(getId(req), (req.body as { status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' }).status));

export const ambulancesController = async (_req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.listAmbulances(getValidatedQuery(res)));

export const ambulanceController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.getAmbulance(getId(req)));

export const driversController = async (_req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.listDrivers(getValidatedQuery(res)));

export const driverController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.getDriver(getId(req)));

export const driverVerificationController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.updateDriverVerification(getId(req), (req.body as { verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' }).verificationStatus));

export const driverStatusController = async (req: Request, res: Response): Promise<void> =>
  sendSuccess(res, await s.updateDriverStatus(getId(req), (req.body as { status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' }).status));
