import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { geocodeRequestSchema } from '../schemas/geocoding.js';
import { geocodeController } from '../controllers/geocodingController.js';

export const geocodingRouter = Router();
geocodingRouter.use(authenticate);
geocodingRouter.post('/', validateBody(geocodeRequestSchema), geocodeController);