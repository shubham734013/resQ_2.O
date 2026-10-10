import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { validateBody } from '../middlewares/validate.js';
import {
  hospitalProfileUpdateSchema,
  hospitalServicesUpdateSchema,
  hospitalCapabilitiesUpdateSchema,
  hospitalAvailabilityUpdateSchema,
  hospitalResourcesUpdateSchema,
  hospitalEmergencyListQuerySchema,
  hospitalEmergencyStatusUpdateSchema,
  hospitalCoordinationNotificationListQuerySchema,
  hospitalPatientListQuerySchema,
  hospitalAmbulanceListQuerySchema,
} from '../schemas/hospital.js';
import {
  getProfileController, updateProfileController,
  getServicesController, updateServicesController,
  getCapabilitiesController, updateCapabilitiesController,
  getAvailabilityController, updateAvailabilityController,
  getResourcesController, updateResourcesController,
  listEmergenciesController, getEmergencySummaryController, getEmergencyController, updateEmergencyStatusController,
  listPatientsController, getPatientController,
  listAmbulancesController, getAmbulanceController,
  listCoordinationNotificationsController, acknowledgeCoordinationNotificationController, getCoordinationDetailController,
} from '../controllers/hospitalController.js';
import type { z } from 'zod';

const validateQuery = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.query);
  if (!result.success) { next(result.error); return; }
  res.locals.validatedQuery = result.data;
  next();
};

export const hospitalRouter = Router();
hospitalRouter.use(authenticate, authorizeRole('HOSPITAL'));

hospitalRouter.get('/profile', getProfileController);
hospitalRouter.patch('/profile', validateBody(hospitalProfileUpdateSchema), updateProfileController);

hospitalRouter.get('/services', getServicesController);
hospitalRouter.patch('/services', validateBody(hospitalServicesUpdateSchema), updateServicesController);

hospitalRouter.get('/capabilities', getCapabilitiesController);
hospitalRouter.patch('/capabilities', validateBody(hospitalCapabilitiesUpdateSchema), updateCapabilitiesController);

hospitalRouter.get('/availability', getAvailabilityController);
hospitalRouter.patch('/availability', validateBody(hospitalAvailabilityUpdateSchema), updateAvailabilityController);

hospitalRouter.get('/resources', getResourcesController);
hospitalRouter.patch('/resources', validateBody(hospitalResourcesUpdateSchema), updateResourcesController);

hospitalRouter.get('/emergencies/summary', getEmergencySummaryController);
hospitalRouter.get('/emergencies', validateQuery(hospitalEmergencyListQuerySchema), listEmergenciesController);
hospitalRouter.get('/emergencies/:id', getEmergencyController);
hospitalRouter.patch('/emergencies/:id/status', validateBody(hospitalEmergencyStatusUpdateSchema), updateEmergencyStatusController);

hospitalRouter.get('/patients', validateQuery(hospitalPatientListQuerySchema), listPatientsController);
hospitalRouter.get('/patients/:id', getPatientController);

hospitalRouter.get('/ambulances', validateQuery(hospitalAmbulanceListQuerySchema), listAmbulancesController);
hospitalRouter.get('/ambulances/:id', getAmbulanceController);

hospitalRouter.get('/coordination/notifications', validateQuery(hospitalCoordinationNotificationListQuerySchema), listCoordinationNotificationsController);
hospitalRouter.post('/coordination/notifications/:id/acknowledge', acknowledgeCoordinationNotificationController);
hospitalRouter.get('/coordination/emergencies/:id', getCoordinationDetailController);
