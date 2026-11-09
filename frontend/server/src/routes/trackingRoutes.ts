import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getEmergencyTrackingSnapshot, getTripNavigationRoute, getTripTrackingSnapshot } from '../services/trackingService.js';

export const trackingRouter = Router();
trackingRouter.use(authenticate);
const identity = (req: Request) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) throw new Error('Authentication required');
  return auth;
};
const id = (req: Request) => {
  const value = req.params.id;
  if (typeof value !== 'string') throw new Error('Invalid tracking resource ID');
  return value;
};

trackingRouter.get('/emergencies/:id', async (req: Request, res: Response) => sendSuccess(res, await getEmergencyTrackingSnapshot(identity(req), id(req))));
trackingRouter.get('/trips/:id', async (req: Request, res: Response) => sendSuccess(res, await getTripTrackingSnapshot(identity(req), id(req))));
trackingRouter.get('/trips/:id/route', async (req: Request, res: Response) => sendSuccess(res, await getTripNavigationRoute(identity(req), id(req))));
