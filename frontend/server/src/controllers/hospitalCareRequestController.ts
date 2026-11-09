import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/hospitalCareRequestService.js';
import { AppError } from '../utils/AppError.js';

const getUserId = (req: AuthenticatedRequest): string => {
  if (!req.auth?.id) throw new AppError('UNAUTHORIZED', 'Authentication is required', 401);
  return req.auth.id;
};

const getHospitalId = (req: AuthenticatedRequest): string => {
  if (!req.auth?.id || req.auth.role !== 'HOSPITAL') {
    throw new AppError('FORBIDDEN', 'Hospital authentication is required', 403);
  }
  return req.auth.id;
};

const getResourceId = (req: AuthenticatedRequest): string => {
  const value = req.params.id;
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('INVALID_ID', 'Resource ID is required', 400);
  }
  return value.trim();
};

// Citizen endpoints
export const createCareRequestController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const result = await service.createCareRequest(userId, req.body);
  sendSuccess(res, result, 201);
};

export const listMyCareRequestsController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const query = res.locals.validatedQuery ?? req.query;
  const result = await service.listUserCareRequests(userId, query);
  sendSuccess(res, result);
};

export const getMyCareRequestByIdController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const requestId = getResourceId(req);
  const result = await service.getUserCareRequestById(userId, requestId);
  sendSuccess(res, result);
};

export const cancelMyCareRequestController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const requestId = getResourceId(req);
  const result = await service.cancelUserCareRequest(userId, requestId, req.body?.cancellationReason);
  sendSuccess(res, result);
};

// Hospital endpoints
export const listIncomingCareRequestsController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const query = res.locals.validatedQuery ?? req.query;
  const result = await service.listHospitalIncomingCareRequests(hospitalId, query);
  sendSuccess(res, result);
};

export const getHospitalCareRequestByIdController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const requestId = getResourceId(req);
  const result = await service.getHospitalCareRequestById(hospitalId, requestId);
  sendSuccess(res, result);
};

export const respondCareRequestController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const requestId = getResourceId(req);
  const result = await service.respondToCareRequest(hospitalId, requestId, req.body);
  sendSuccess(res, result);
};
