import type { Response } from 'express';

export interface RealtimeEventPayload {
  channel: string;
  event: string;
  data: unknown;
  timestamp: string;
}

interface RealtimeClient {
  id: string;
  channel: string;
  res: Response;
  connectedAt: Date;
  lastPingAt: Date;
}

const clients = new Map<string, RealtimeClient>();

let heartbeatTimer: NodeJS.Timeout | null = null;

const ensureHeartbeat = () => {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const deadIds: string[] = [];
    for (const [id, client] of clients.entries()) {
      try {
        client.res.write(':ping\n\n');
        client.lastPingAt = new Date();
      } catch {
        deadIds.push(id);
      }
    }
    deadIds.forEach((id) => clients.delete(id));
  }, 15000);
  heartbeatTimer.unref();
};

export const registerRealtimeClient = (id: string, channel: string, res: Response): void => {
  ensureHeartbeat();
  clients.set(id, {
    id,
    channel,
    res,
    connectedAt: new Date(),
    lastPingAt: new Date(),
  });
};

export const unregisterRealtimeClient = (id: string): void => {
  clients.delete(id);
};

export const getConnectedClientsCount = (): number => clients.size;

export const broadcastEvent = (channel: string, event: string, data: unknown): void => {
  const payload: RealtimeEventPayload = {
    channel,
    event,
    data,
    timestamp: new Date().toISOString(),
  };
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

  const deadIds: string[] = [];
  for (const [id, client] of clients.entries()) {
    // Exact channel match, global wildcard, or operations listening channel
    // Channel authorization is enforced before registration in realtimeRoutes.
    // Keep delivery exact-match only so one hospital/driver cannot receive
    // another tenant's events by sharing a channel prefix.
    const shouldReceive = client.channel === channel || client.channel === 'operations';

    if (shouldReceive) {
      try {
        client.res.write(message);
      } catch {
        deadIds.push(id);
      }
    }
  }
  deadIds.forEach((id) => clients.delete(id));
};
