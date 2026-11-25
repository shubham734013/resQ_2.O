import { Router } from 'express';
import { validateBody } from '../middlewares/validate.js';
import { routeRequestSchema } from '../schemas/maps.js';
import { calculateRouteController } from '../controllers/mapsController.js';

export const mapsRouter = Router();
mapsRouter.post('/routes', validateBody(routeRequestSchema), calculateRouteController);