import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { Types } from 'mongoose';
import { authenticateAccessToken } from './authService.js';
import { getAllowedOrigins } from '../middlewares/security.js';
import type { AuthenticatedIdentity } from '../types/auth.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { AppError } from '../utils/AppError.js';
import { canAccessTrackingSnapshot } from './trackingService.js';

type RoomRequest = { type: 'emergency' | 'trip' | 'hospital-operations'; id: string };
type Envelope = { channel: string; event: string; data: unknown; timestamp: string };
let io: Server | null = null;

const tokenFromSocket = (socket: Socket): string | undefined => {
  const token = socket.handshake.auth?.token;
  if (typeof token === 'string' && token.trim()) return token.trim();
  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) return authorization.slice(7).trim();
  const header = socket.handshake.headers.cookie;
  const item = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith('resq_access_token='));
  if (!item) return undefined;
  try { return decodeURIComponent(item.slice('resq_access_token='.length)); } catch { return undefined; }
};
const validId = (id: string) => /^[a-f0-9]{24}$/i.test(id) && Types.ObjectId.isValid(id);
const roomFor = (request: RoomRequest) => request.type === 'hospital-operations' ? `hospital-operations:${request.id}` : `${request.type}:${request.id}`;

const canAccessTrip = async (identity: AuthenticatedIdentity, tripId: Types.ObjectId): Promise<boolean> => {
  if (identity.role === 'ADMIN') return true;
  const trip = await TripModel.findById(tripId).select('driverId providerId destinationHospitalId emergencyRequestId').lean().exec();
  if (!trip) return false;
  const emergency = await EmergencyRequestModel.findById(trip.emergencyRequestId).select('userId hospitalId ambulanceProviderId').lean().exec();
  return Boolean(emergency && canAccessTrackingSnapshot(identity, emergency, trip));
};
const canAccessEmergency = async (identity: AuthenticatedIdentity, id: Types.ObjectId): Promise<boolean> => {
  const emergency = await EmergencyRequestModel.findById(id).select('userId hospitalId ambulanceProviderId').lean().exec();
  if (!emergency) return false;
  const trip = await TripModel.findOne({ emergencyRequestId: id }).select('driverId providerId').lean().exec();
  return canAccessTrackingSnapshot(identity, emergency, trip);
};
const authorized = async (identity: AuthenticatedIdentity, request: RoomRequest): Promise<boolean> => {
  if (!validId(request.id)) return false;
  if (request.type === 'emergency') return canAccessEmergency(identity, new Types.ObjectId(request.id));
  if (request.type === 'trip') return canAccessTrip(identity, new Types.ObjectId(request.id));
  if (request.type === 'hospital-operations') return identity.role === 'ADMIN' || (identity.role === 'HOSPITAL' && identity.id === request.id);
  return false;
};

export const initializeTrackingSockets = (httpServer: HttpServer): (() => Promise<void>) => {
  if (io) throw new Error('Tracking Socket.IO has already been initialized.');
  io = new Server(httpServer, { cors: { origin: getAllowedOrigins(), credentials: true, methods: ['GET', 'POST'] }, transports: ['websocket', 'polling'], connectTimeout: 10000, maxHttpBufferSize: 16000 });
  io.use(async (socket, next) => {
    try {
      const token = tokenFromSocket(socket);
      if (!token) throw new AppError('UNAUTHORIZED', 'Socket authentication is required.', 401);
      socket.data.identity = await authenticateAccessToken(token);
      next();
    } catch { next(new Error('UNAUTHORIZED')); }
  });
  io.on('connection', (socket) => {
    socket.emit('tracking:connected', { connectedAt: new Date().toISOString() });
    socket.on('tracking:subscribe', (raw: unknown, ack?: (result: { ok: boolean; room?: string; error?: string }) => void) => {
      void (async () => {
        if (!raw || typeof raw !== 'object') { ack?.({ ok: false, error: 'INVALID_SUBSCRIPTION' }); return; }
        const candidate = raw as Partial<RoomRequest>;
        if (!['emergency', 'trip', 'hospital-operations'].includes(String(candidate.type)) || typeof candidate.id !== 'string') { ack?.({ ok: false, error: 'INVALID_SUBSCRIPTION' }); return; }
        const request: RoomRequest = { type: candidate.type as RoomRequest['type'], id: candidate.id };
        const identity = socket.data.identity as AuthenticatedIdentity;
        if (!(await authorized(identity, request))) { ack?.({ ok: false, error: 'FORBIDDEN' }); return; }
        const room = roomFor(request);
        await socket.join(room);
        if (request.type === 'emergency') {
          const trip = await TripModel.findOne({ emergencyRequestId: new Types.ObjectId(request.id) }).select('_id status').lean().exec();
          if (trip && !['COMPLETED', 'CANCELLED'].includes(trip.status) && await canAccessTrip(identity, trip._id)) await socket.join(`trip:${String(trip._id)}`);
        }
        ack?.({ ok: true, room });
      })().catch(() => ack?.({ ok: false, error: 'SUBSCRIPTION_FAILED' }));
    });
    socket.on('tracking:unsubscribe', (raw: unknown, ack?: (result: { ok: boolean }) => void) => {
      void (async () => {
        if (!raw || typeof raw !== 'object') { ack?.({ ok: false }); return; }
        const request = raw as Partial<RoomRequest>;
        if (!['emergency', 'trip', 'hospital-operations'].includes(String(request.type)) || typeof request.id !== 'string' || !validId(request.id)) { ack?.({ ok: false }); return; }
        await socket.leave(roomFor(request as RoomRequest));
        if (request.type === 'emergency') {
          const trip = await TripModel.findOne({ emergencyRequestId: new Types.ObjectId(request.id) }).select('_id').lean().exec();
          if (trip) await socket.leave(`trip:${String(trip._id)}`);
        }
        ack?.({ ok: true });
      })().catch(() => ack?.({ ok: false }));
    });
  });
  return async () => { const current = io; io = null; if (current) await current.close(); };
};

export const publishSocketEvent = (channel: string, event: string, envelope: Envelope): void => {
  if (!io) return;
  let room: string | null = null;
  if (/^emergency:[a-f0-9]{24}$/i.test(channel)) room = channel;
  else if (/^trip:[a-f0-9]{24}$/i.test(channel)) room = channel;
  else if (/^hospital:[a-f0-9]{24}$/i.test(channel)) room = channel.replace(/^hospital:/, 'hospital-operations:');
  if (room) {
    io.to(room).emit(event, envelope);
    const status = envelope.data && typeof envelope.data === 'object' && 'status' in envelope.data ? String((envelope.data as { status: unknown }).status) : '';
    if (room.startsWith('trip:') && event === 'tracking:status' && ['COMPLETED', 'CANCELLED'].includes(status)) {
      // Deliver the terminal state once, then remove every socket from the trip room.
      void io.in(room).socketsLeave(room);
    }
  }
};
