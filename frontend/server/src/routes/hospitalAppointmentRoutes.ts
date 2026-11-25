import { Router, type Response } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import {
  queryAvailabilitySchema,
  bookAppointmentSchema,
  confirmAppointmentSchema,
  rejectAppointmentSchema,
  proposeAlternativeSlotSchema,
  cancelAppointmentSchema,
  updateAvailabilitySchema,
  listAppointmentsQuerySchema,
} from '../schemas/hospitalAppointment.js';
import {
  queryAvailabilityController,
  bookAppointmentController,
  listMyAppointmentsController,
  getMyAppointmentByIdController,
  cancelMyAppointmentController,
  listHospitalAppointmentsController,
  getHospitalAppointmentByIdController,
  confirmHospitalAppointmentController,
  rejectHospitalAppointmentController,
  proposeAlternativeSlotController,
  completeHospitalAppointmentController,
  getHospitalAvailabilitySettingsController,
  updateHospitalAvailabilitySettingsController,
} from '../controllers/hospitalAppointmentController.js';
import { AppError } from '../utils/AppError.js';

export const appointmentRouter = Router();

// Dispatcher for GET /api/v1/appointments/:id based on role
const getAppointmentByIdDispatcher = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.auth?.role === 'HOSPITAL') {
    return getHospitalAppointmentByIdController(req, res);
  }
  if (req.auth?.role === 'USER') {
    return getMyAppointmentByIdController(req, res);
  }
  throw new AppError('FORBIDDEN', 'Access denied', 403);
};

// Availability query
appointmentRouter.get(
  '/availability',
  authenticate,
  validateQuery(queryAvailabilitySchema),
  queryAvailabilityController
);

// Citizen routes
appointmentRouter.post(
  '/',
  authenticate,
  authorizeRole('USER'),
  validateBody(bookAppointmentSchema),
  bookAppointmentController
);

appointmentRouter.get(
  '/mine',
  authenticate,
  authorizeRole('USER'),
  validateQuery(listAppointmentsQuerySchema),
  listMyAppointmentsController
);

appointmentRouter.post(
  '/:id/cancel',
  authenticate,
  authorizeRole('USER'),
  validateBody(cancelAppointmentSchema),
  cancelMyAppointmentController
);

// Detail route
appointmentRouter.get(
  '/:id',
  authenticate,
  getAppointmentByIdDispatcher
);

// Hospital appointment management router (for /api/v1/hospital-appointments)
export const hospitalAppointmentManagementRouter = Router();
hospitalAppointmentManagementRouter.use(authenticate, authorizeRole('HOSPITAL'));

hospitalAppointmentManagementRouter.get(
  '/',
  validateQuery(listAppointmentsQuerySchema),
  listHospitalAppointmentsController
);

hospitalAppointmentManagementRouter.get(
  '/:id',
  getHospitalAppointmentByIdController
);

hospitalAppointmentManagementRouter.post(
  '/:id/confirm',
  validateBody(confirmAppointmentSchema),
  confirmHospitalAppointmentController
);

hospitalAppointmentManagementRouter.post(
  '/:id/reject',
  validateBody(rejectAppointmentSchema),
  rejectHospitalAppointmentController
);

hospitalAppointmentManagementRouter.post(
  '/:id/propose-alternative',
  validateBody(proposeAlternativeSlotSchema),
  proposeAlternativeSlotController
);

hospitalAppointmentManagementRouter.post(
  '/:id/complete',
  completeHospitalAppointmentController
);

hospitalAppointmentManagementRouter.get(
  '/settings/availability',
  getHospitalAvailabilitySettingsController
);

hospitalAppointmentManagementRouter.put(
  '/settings/availability',
  validateBody(updateAvailabilitySchema),
  updateHospitalAvailabilitySettingsController
);
