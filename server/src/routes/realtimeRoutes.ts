import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { authenticate } from '../middlewares/authenticate.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { registerRealtimeClient, unregisterRealtimeClient } from '../services/realtimeService.js';
import { AppError } from '../utils/AppError.js';

export const realtimeRouter = Router();

const maySubscribe = async (req: AuthenticatedRequest, channel: string): Promise<boolean> => {
  const auth = req.auth;
  if (!auth) return false;
  if (auth.role === 'ADMIN') return true;
  if (channel === '*' || channel === 'operations' || !channel.includes(':')) return false;
  const [kind, resourceId, ...rest] = channel.split(':');
  if (!resourceId || rest.length > 0 || channel.length > 100 || !Types.ObjectId.isValid(resourceId)) return false;

  if (auth.role === 'AMBULANCE_DRIVER') {
    if (kind === 'driver') return resourceId === auth.id;
    if (kind === 'ambulance') {
      const driver = await AmbulanceDriverModel.findOne({ _id: auth.id, accountStatus: 'ACTIVE' }).select('assignedAmbulanceId').lean().exec();
      return Boolean(driver?.assignedAmbulanceId && String(driver.assignedAmbulanceId) === resourceId);
    }
    if (kind === 'emergency') {
      const emergency = await EmergencyRequestModel.findById(resourceId).select('driverId').lean().exec();
      if (emergency && String(emergency.driverId ?? '') === auth.id) return true;
      return Boolean(await TripModel.exists({ emergencyRequestId: new Types.ObjectId(resourceId), driverId: new Types.ObjectId(auth.id) }));
    }
    return false;
  }
  if (auth.role === 'AMBULANCE_PROVIDER') {
    if (kind === 'provider') return resourceId === auth.id;
    if (kind === 'ambulance') return Boolean(await AmbulanceModel.exists({ _id: resourceId, providerId: auth.id }));
    if (kind === 'driver') return Boolean(await AmbulanceDriverModel.exists({ _id: resourceId, providerId: auth.id }));
    if (kind === 'emergency') return Boolean(await EmergencyRequestModel.exists({ _id: resourceId, ambulanceProviderId: auth.id }));
    return false;
  }
  if (auth.role === 'HOSPITAL') {
    if (kind === 'hospital') return resourceId === auth.id;
    if (kind === 'emergency') return Boolean(await EmergencyRequestModel.exists({ _id: resourceId, hospitalId: auth.id }));
    return false;
  }
  if (auth.role === 'USER') {
    if (kind === 'emergency') return Boolean(await EmergencyRequestModel.exists({ _id: resourceId, userId: auth.id }));
  }
  return false;
};

realtimeRouter.get('/stream', authenticate, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const channel = typeof req.query.channel === 'string' && req.query.channel.trim() ? req.query.channel.trim() : '';
  if (!channel || !(await maySubscribe(authReq, channel))) {
    throw new AppError('REALTIME_CHANNEL_FORBIDDEN', 'You are not authorized to subscribe to this realtime channel.', 403);
  }
  const clientId = randomUUID();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  registerRealtimeClient(clientId, channel, res);
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, channel, timestamp: new Date().toISOString() })}\n\n`);
  req.on('close', () => unregisterRealtimeClient(clientId));
});
