import type { Request, Response } from 'express';
import { searchGooglePlaces } from '../services/placesService.js';

export const placesSearchController = async (_req: Request, res: Response): Promise<void> => {
  const data = await searchGooglePlaces(res.locals.validatedBody.query);
  res.json({ success: true, data });
};
