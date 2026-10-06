import { Router, type Request, type Response, type NextFunction } from 'express';
import type { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { routeRequestSchema } from '../schemas/maps.js';
import { calculateRouteController } from '../controllers/mapsController.js';

const validateQuery = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.query);
  if (!result.success) { next(result.error); return; }
  res.locals.validatedQuery = result.data;
  next();
};

export const mapsRouter = Router();
mapsRouter.use(authenticate);
mapsRouter.post('/routes', validateBody(routeRequestSchema), calculateRouteController);
void validateQuery;