import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { registerRealtimeClient, unregisterRealtimeClient } from '../services/realtimeService.js';

export const realtimeRouter = Router();

realtimeRouter.get('/stream', (req: Request, res: Response): void => {
  const channel = typeof req.query.channel === 'string' && req.query.channel.trim() ? req.query.channel.trim() : '*';
  const clientId = randomUUID();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush headers immediately
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  registerRealtimeClient(clientId, channel, res);

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, channel, timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    unregisterRealtimeClient(clientId);
  });
});
