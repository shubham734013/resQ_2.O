import { Router, type Request, type Response, type NextFunction } from 'express';
import type { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { facilitySearchQuerySchema } from '../schemas/facility.js';
import { getFacilityController, searchFacilitiesController } from '../controllers/facilityController.js';

const validateQuery = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.query);
  if (!result.success) { next(result.error); return; }
  res.locals.validatedQuery = result.data;
  next();
};

export const facilityRouter = Router();
facilityRouter.use(authenticate);
facilityRouter.get('/search', validateQuery(facilitySearchQuerySchema), searchFacilitiesController);
facilityRouter.get('/:id', getFacilityController);