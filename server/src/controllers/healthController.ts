import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';

export const healthController = (_req: Request, res: Response): void => {
  sendSuccess(res, { status: 'ok' });
};
