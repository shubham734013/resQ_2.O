import type { Request, Response } from 'express';
import { geocodeAddress } from '../services/geocodingService.js';

export const geocodeController = async (_req: Request, res: Response): Promise<void> => {
  const data = await geocodeAddress(res.locals.validatedBody.address);
  res.json({ success: true, data });
};