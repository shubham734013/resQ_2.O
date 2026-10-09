import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { placeSearchSchema } from '../schemas/places.js';
import { placesSearchController } from '../controllers/placesController.js';

export const placesRouter = Router();
placesRouter.use(authenticate);
placesRouter.post('/search', validateBody(placeSearchSchema), placesSearchController);
