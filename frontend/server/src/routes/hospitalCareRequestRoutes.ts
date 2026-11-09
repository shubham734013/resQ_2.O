import { Router, type Response } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import {
  createCareRequestSchema,
  respondCareRequestSchema,
  cancelCareRequestSchema,
  listCareRequestsQuerySchema,
} from '../schemas/hospitalCareRequest.js';
import {
  createCareRequestController,
  listMyCareRequestsController,
  getMyCareRequestByIdController,
  cancelMyCareRequestController,
  listIncomingCareRequestsController,
  getHospitalCareRequestByIdController,
  respondCareRequestController,
} from '../controllers/hospitalCareRequestController.js';
import { AppError } from '../utils/AppError.js';

export const hospitalCareRequestRouter = Router();

// Dispatcher for GET /api/v1/hospital-requests/:id based on role
const getCareRequestByIdDispatcher = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.auth?.role === 'HOSPITAL') {
    return getHospitalCareRequestByIdController(req, res);
  }
  if (req.auth?.role === 'USER') {
    return getMyCareRequestByIdController(req, res);
  }
  throw new AppError('FORBIDDEN', 'Access denied', 403);
};

// Citizen routes
hospitalCareRequestRouter.post(
  '/',
  authenticate,
  authorizeRole('USER'),
  validateBody(createCareRequestSchema),
  createCareRequestController
);

hospitalCareRequestRouter.get(
  '/mine',
  authenticate,
  authorizeRole('USER'),
  validateQuery(listCareRequestsQuerySchema),
  listMyCareRequestsController
);

hospitalCareRequestRouter.post(
  '/:id/cancel',
  authenticate,
  authorizeRole('USER'),
  validateBody(cancelCareRequestSchema),
  cancelMyCareRequestController
);

// Hospital routes
hospitalCareRequestRouter.get(
  '/incoming',
  authenticate,
  authorizeRole('HOSPITAL'),
  validateQuery(listCareRequestsQuerySchema),
  listIncomingCareRequestsController
);

hospitalCareRequestRouter.post(
  '/:id/respond',
  authenticate,
  authorizeRole('HOSPITAL'),
  validateBody(respondCareRequestSchema),
  respondCareRequestController
);

// Shared detail route (authenticated user or hospital)
hospitalCareRequestRouter.get(
  '/:id',
  authenticate,
  getCareRequestByIdDispatcher
);
