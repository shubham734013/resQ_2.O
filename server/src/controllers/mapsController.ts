import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { calculateGoogleRoutes } from '../services/mapsService.js';

export const calculateRouteController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await calculateGoogleRoutes(res.locals.validatedBody);
  res.json({ success: true, data: result });
};