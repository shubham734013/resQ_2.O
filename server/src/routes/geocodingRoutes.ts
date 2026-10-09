import { Router } from 'express';
import { validateBody } from '../middlewares/validate.js';
import { geocodeRequestSchema } from '../schemas/geocoding.js';
import { geocodeController } from '../controllers/geocodingController.js';

export const geocodingRouter = Router();
geocodingRouter.post('/', validateBody(geocodeRequestSchema), geocodeController);