import { Router, type Request, type Response, type NextFunction } from 'express';
import type { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { nearbyQuerySchema } from '../schemas/maps.js';
import { nearbyAmbulancesController, nearbyFacilitiesController } from '../controllers/geospatialController.js';

const validateQuery = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.query);
  if (!result.success) { next(result.error); return; }
  res.locals.validatedQuery = result.data;
  next();
};

export const geospatialRouter = Router();
geospatialRouter.use(authenticate);
geospatialRouter.get('/facilities/nearby', validateQuery(nearbyQuerySchema), nearbyFacilitiesController);
geospatialRouter.get('/ambulances/nearby', validateQuery(nearbyQuerySchema), nearbyAmbulancesController);