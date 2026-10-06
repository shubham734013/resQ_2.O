import type { Request, Response } from 'express';
import { getFacility, searchFacilities } from '../services/facilityService.js';
import { AppError } from '../utils/AppError.js';

export const searchFacilitiesController = async (_req: Request, res: Response): Promise<void> => {
  const data = await searchFacilities(res.locals.validatedQuery);
  res.json({ success: true, data });
};

export const getFacilityController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (typeof id !== 'string') throw new AppError('INVALID_ID', 'Invalid facility id', 400);
  const data = await getFacility(id);
  res.json({ success: true, data });
};