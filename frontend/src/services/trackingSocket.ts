import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from './apiConfig';

export interface TrackingEnvelope<T = unknown> {
  channel: string;
  event: string;
  data: T;
  timestamp: string;
}
export type TrackingRoom = { type: 'emergency' | 'trip' | 'hospital-operations'; id: string };

export const createTrackingSocket = (): Socket => {
  const socket = io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    transports: ['polling', 'websocket'],
  });

  socket.on('connect_error', (error) => {
    if (error?.message === 'UNAUTHORIZED' || error?.message?.includes('UNAUTHORIZED')) {
      socket.disconnect();
    }
  });

  return socket;
};

export const subscribeTrackingRoom = (socket: Socket, room: TrackingRoom) => new Promise<void>((resolve, reject) => {
  socket.emit('tracking:subscribe', room, (result: { ok: boolean; error?: string }) => {
    if (result?.ok) resolve();
    else reject(new Error(result?.error === 'FORBIDDEN' ? 'You are not authorized to view this tracking session.' : 'Could not subscribe to live tracking. Refresh to recover.'));
  });
});
