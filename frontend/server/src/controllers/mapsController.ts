import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { calculateGoogleRoutes } from '../services/mapsService.js';

export const calculateRouteController = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await calculateGoogleRoutes(res.locals.validatedBody ?? _req.body);
  res.json({ success: true, data: result });
};