import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/hospitalAppointmentService.js';
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

// Availability queries (accessible to citizen and hospital)
export const queryAvailabilityController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const query = (res.locals.validatedQuery ?? req.query) as {
    hospitalId: string;
    department: string;
    date: string;
  };
  const result = await service.getAvailableSlotsForDate(query.hospitalId, query.department, query.date);
  sendSuccess(res, result);
};

// Citizen appointment actions
export const bookAppointmentController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const result = await service.bookAppointment(userId, req.body);
  sendSuccess(res, result, 201);
};

export const listMyAppointmentsController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const query = res.locals.validatedQuery ?? req.query;
  const result = await service.listUserAppointments(userId, query);
  sendSuccess(res, result);
};

export const getMyAppointmentByIdController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const appointmentId = getResourceId(req);
  const result = await service.getUserAppointmentById(userId, appointmentId);
  sendSuccess(res, result);
};

export const cancelMyAppointmentController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const appointmentId = getResourceId(req);
  const result = await service.cancelUserAppointment(userId, appointmentId, req.body?.cancellationReason);
  sendSuccess(res, result);
};

// Hospital appointment management actions
export const listHospitalAppointmentsController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const query = res.locals.validatedQuery ?? req.query;
  const result = await service.listHospitalAppointments(hospitalId, query);
  sendSuccess(res, result);
};

export const getHospitalAppointmentByIdController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const appointmentId = getResourceId(req);
  const result = await service.getHospitalAppointmentById(hospitalId, appointmentId);
  sendSuccess(res, result);
};

export const confirmHospitalAppointmentController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const appointmentId = getResourceId(req);
  const result = await service.confirmHospitalAppointment(hospitalId, appointmentId, req.body?.notes);
  sendSuccess(res, result);
};

export const rejectHospitalAppointmentController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const appointmentId = getResourceId(req);
  const result = await service.rejectHospitalAppointment(hospitalId, appointmentId, req.body.rejectionReason);
  sendSuccess(res, result);
};

export const proposeAlternativeSlotController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const appointmentId = getResourceId(req);
  const result = await service.proposeAlternativeSlot(hospitalId, appointmentId, req.body);
  sendSuccess(res, result);
};

export const completeHospitalAppointmentController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const appointmentId = getResourceId(req);
  const result = await service.completeHospitalAppointment(hospitalId, appointmentId);
  sendSuccess(res, result);
};

// Hospital availability settings
export const getHospitalAvailabilitySettingsController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const result = await service.listHospitalAvailabilities(hospitalId);
  sendSuccess(res, result);
};

export const updateHospitalAvailabilitySettingsController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const hospitalId = getHospitalId(req);
  const result = await service.upsertHospitalAvailability(hospitalId, req.body);
  sendSuccess(res, result);
};
