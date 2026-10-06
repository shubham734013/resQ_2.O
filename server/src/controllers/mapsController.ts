import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { calculateOpenStreetMapRoute } from '../services/mapsService.js';

export const calculateRouteController = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await calculateOpenStreetMapRoute(res.locals.validatedBody);
  res.json({ success: true, data: result });
};
