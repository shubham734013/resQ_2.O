import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { listNearbyAmbulances, listNearbyFacilities } from '../services/geospatialService.js';

export const nearbyFacilitiesController = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await listNearbyFacilities(res.locals.validatedQuery);
  res.json({ success: true, data });
};

export const nearbyAmbulancesController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await listNearbyAmbulances(res.locals.validatedQuery);
  res.json({ success: true, data });
};