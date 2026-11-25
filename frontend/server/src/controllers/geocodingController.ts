import type { Request, Response } from 'express';
import { geocodeAddress } from '../services/geocodingService.js';

export const geocodeController = async (_req: Request, res: Response): Promise<void> => {
  const body = (res.locals.validatedBody ?? _req.body) as { address: string };
  const data = await geocodeAddress(body.address);
  res.json({ success: true, data });
};