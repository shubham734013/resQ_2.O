import type { Request, Response } from 'express';
import { getFacility, searchFacilities } from '../services/facilityService.js';

export const searchFacilitiesController = async (_req: Request, res: Response): Promise<void> => {
  const data = await searchFacilities(res.locals.validatedQuery);
  res.json({ success: true, data });
};

export const getFacilityController = async (req: Request, res: Response): Promise<void> => {
  const data = await getFacility(req.params.id);
  res.json({ success: true, data });
};