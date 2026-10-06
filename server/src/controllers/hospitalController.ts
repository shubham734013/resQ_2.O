import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/hospitalService.js';

const hospitalId = (req: Request): string => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth || auth.role !== 'HOSPITAL') throw new Error('Hospital authentication required');
  return auth.id;
};

const id = (req: Request): string => {
  const value = req.params.id;
  if (typeof value !== 'string') throw new Error('Invalid resource id');
  return value;
};

const query = <T>(res: Response): T => res.locals.validatedQuery as T;

export const getProfileController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.getProfile(hospitalId(req)));
export const updateProfileController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.updateProfile(hospitalId(req), req.body));
export const getServicesController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.getServices(hospitalId(req)));
export const updateServicesController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.updateServices(hospitalId(req), req.body));
export const getCapabilitiesController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.getCapabilities(hospitalId(req)));
export const updateCapabilitiesController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.updateCapabilities(hospitalId(req), req.body));
export const getAvailabilityController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.getAvailability(hospitalId(req)));
export const updateAvailabilityController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.updateAvailability(hospitalId(req), req.body));
export const getResourcesController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.getResources(hospitalId(req)));
export const updateResourcesController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.updateResources(hospitalId(req), req.body));

export const listEmergenciesController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.listEmergencies(hospitalId(req), query(res)));
export const getEmergencyController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.getEmergency(hospitalId(req), id(req)));
export const updateEmergencyStatusController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.updateEmergencyStatus(hospitalId(req), id(req), req.body.status));

export const listPatientsController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.listPatients(hospitalId(req), query(res)));
export const getPatientController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.getPatient(hospitalId(req), id(req)));

export const listAmbulancesController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.listAmbulances(hospitalId(req), query(res)));
export const getAmbulanceController = async (req: Request, res: Response): Promise<void> => sendSuccess(res, await service.getAmbulance(hospitalId(req), id(req)));
