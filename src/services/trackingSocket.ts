import { io, type Socket } from 'socket.io-client';

const API_BASE = (() => {
  const value = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!value) throw new Error('VITE_API_BASE_URL is required.');
  return value.replace(/\/$/, '');
})();
const SOCKET_URL = API_BASE.replace(/\/api\/v1\/?$/, '');

export interface TrackingEnvelope<T = unknown> {
  channel: string;
  event: string;
  data: T;
  timestamp: string;
}
export type TrackingRoom = { type: 'emergency' | 'trip' | 'hospital-operations'; id: string };

export const createTrackingSocket = () => io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  transports: ['websocket', 'polling'],
});

export const subscribeTrackingRoom = (socket: Socket, room: TrackingRoom) => new Promise<void>((resolve, reject) => {
  socket.emit('tracking:subscribe', room, (result: { ok: boolean; error?: string }) => {
    if (result?.ok) resolve();
    else reject(new Error(result?.error === 'FORBIDDEN' ? 'You are not authorized to view this tracking session.' : 'Could not subscribe to live tracking. Refresh to recover.'));
  });
});
