import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { authenticate } from '../middlewares/authenticate.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { registerRealtimeClient, unregisterRealtimeClient } from '../services/realtimeService.js';

export const realtimeRouter = Router();

/**
 * Realtime streams are private. Never accept a client-selected wildcard or
 * trust a channel name without checking the authenticated identity.
 */
realtimeRouter.get('/stream', authenticate, async (req: Request, res: Response): Promise<void> => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } });
    return;
  }

  const channel = typeof req.query.channel === 'string' ? req.query.channel.trim() : '';
  if (!channel || channel === '*') {
    res.status(400).json({ success: false, error: { code: 'INVALID_CHANNEL', message: 'A specific authorized realtime channel is required' } });
    return;
  }

  let authorized = false;
  if (channel === 'operations') {
    authorized = auth.role === 'ADMIN';
  } else if (channel.startsWith('hospital:')) {
    authorized = auth.role === 'HOSPITAL' && channel === `hospital:${auth.id}`;
  } else if (channel.startsWith('driver:')) {
    authorized = auth.role === 'AMBULANCE_DRIVER' && channel === `driver:${auth.id}`;
  } else if (channel.startsWith('provider:')) {
    authorized = auth.role === 'AMBULANCE_PROVIDER' && channel === `provider:${auth.id}`;
  } else if (channel.startsWith('emergency:')) {
    const emergencyId = channel.slice('emergency:'.length);
    if (Types.ObjectId.isValid(emergencyId)) {
      const emergency = await EmergencyRequestModel.findById(emergencyId).select('userId hospitalId ambulanceProviderId driverId').lean().exec();
      if (emergency) {
        if (auth.role === 'ADMIN') authorized = true;
        else if (auth.role === 'USER') authorized = String(emergency.userId) === auth.id;
        else if (auth.role === 'HOSPITAL') authorized = String(emergency.hospitalId) === auth.id;
        else if (auth.role === 'AMBULANCE_PROVIDER') authorized = String(emergency.ambulanceProviderId ?? '') === auth.id;
        else if (auth.role === 'AMBULANCE_DRIVER') {
          authorized = String(emergency.driverId ?? '') === auth.id;
          if (!authorized) {
            authorized = Boolean(await TripModel.exists({ emergencyRequestId: emergency._id, driverId: new Types.ObjectId(auth.id) }));
          }
        }
      }
    }
  }

  if (!authorized) {
    res.status(403).json({ success: false, error: { code: 'REALTIME_CHANNEL_FORBIDDEN', message: 'You are not authorized to subscribe to this realtime channel' } });
    return;
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
