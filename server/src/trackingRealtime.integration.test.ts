import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { UserModel } from './models/User.js';
import { HospitalModel } from './models/Hospital.js';
import { AmbulanceProviderModel } from './models/AmbulanceProvider.js';
import { AmbulanceModel } from './models/Ambulance.js';
import { AmbulanceDriverModel } from './models/AmbulanceDriver.js';
import { EmergencyRequestModel } from './models/EmergencyRequest.js';
import { TripModel } from './models/Trip.js';

process.env.NODE_ENV ??= 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/resq_test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-that-is-long-enough';
process.env.RESQ_ADMIN_EMAIL ??= 'admin@example.test';
process.env.RESQ_ADMIN_PASSWORD ??= 'test-only-password-long';
const uri = process.env.TRACKING_TEST_MONGODB_URI;
const databaseName = uri ? new URL(uri).pathname.replace(/^\//, '').split('?')[0] ?? '' : '';
const enabled = Boolean(uri && /test|tracking/i.test(databaseName));

const accessToken = (id: Types.ObjectId, email: string, role: 'USER' | 'HOSPITAL') => jwt.sign({
  sub: String(id), email, name: role, role, accountStatus: 'ACTIVE',
  ...(role === 'HOSPITAL' ? { verificationStatus: 'VERIFIED' } : {}), type: 'access',
}, process.env.JWT_SECRET!, { expiresIn: '10m' });

const connect = async (url: string, token: string): Promise<Socket> => {
  const socket = connectSocket(url, { transports: ['websocket'], reconnection: false, timeout: 5000, extraHeaders: { Cookie: 'resq_access_token=' + encodeURIComponent(token) } });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
};
const subscribe = (socket: Socket, room: { type: string; id: string }) => new Promise<{ ok: boolean; room?: string; error?: string }>((resolve) => {
  socket.emit('tracking:subscribe', room, resolve);
});
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('Socket.IO authorizes resource rooms, fans GPS to user/hospital, recovers via REST and cleans terminal trip rooms', { skip: !enabled }, async () => {
  if (!uri) return;
  assert.match(databaseName, /test|tracking/i, 'TRACKING_TEST_MONGODB_URI must use a dedicated test database');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const suffix = new Types.ObjectId().toHexString();
  const userId = new Types.ObjectId();
  const outsiderId = new Types.ObjectId();
  const hospitalId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const ambulanceId = new Types.ObjectId();
  const driverId = new Types.ObjectId();
  const emergencyId = new Types.ObjectId();
  const tripId = new Types.ObjectId();
  let server: ReturnType<typeof createServer> | null = null;
  let stopSockets: (() => Promise<void>) | null = null;
  const sockets: Socket[] = [];
  try {
    await UserModel.create([
      { _id: userId, name: 'Tracking Test User', email: 'tracking-user-' + suffix + '@example.test', role: 'USER', authProvider: 'LOCAL', accountStatus: 'ACTIVE' },
      { _id: outsiderId, name: 'Unrelated User', email: 'tracking-outsider-' + suffix + '@example.test', role: 'USER', authProvider: 'LOCAL', accountStatus: 'ACTIVE' },
    ]);
    await HospitalModel.create({
      _id: hospitalId, name: 'Tracking Test Hospital', registrationNumber: 'TRH-' + suffix,
      email: 'tracking-hospital-' + suffix + '@example.test', phone: '0000000000', passwordHash: 'test-only',
      hospitalType: 'General', latitude: 26.9128, longitude: 75.7875,
      verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await AmbulanceProviderModel.create({
      _id: providerId, name: 'Tracking Test Provider', registrationNumber: 'TRP-' + suffix,
      email: 'tracking-provider-' + suffix + '@example.test', phone: '0000000000', authProvider: 'LOCAL',
      profileCompletionStatus: 'COMPLETE', serviceType: 'Emergency', verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await AmbulanceModel.create({
      _id: ambulanceId, registrationNumber: 'TRA-' + suffix, vehicleNumber: 'TRV-' + suffix,
      providerId, ambulanceType: 'ALS', capabilities: ['Emergency'], currentStatus: 'BUSY',
      verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE', currentLatitude: 26.9124, currentLongitude: 75.7873,
      location: { type: 'Point', coordinates: [75.7873, 26.9124] }, locationUpdatedAt: new Date(),
      locationSourceTimestamp: new Date(), locationAccuracyMeters: 7,
    });
    await AmbulanceDriverModel.create({
      _id: driverId, fullName: 'Tracking Test Driver', email: 'tracking-driver-' + suffix + '@example.test',
      phone: '0000000000', passwordHash: 'test-only', authProvider: 'LOCAL', licenseNumber: 'TRL-' + suffix,
      providerId, assignedAmbulanceId: ambulanceId, availabilityStatus: 'BUSY', profileCompletionStatus: 'COMPLETE',
      licenseVerificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await EmergencyRequestModel.create({
      _id: emergencyId, requestCode: 'TRK-' + suffix.slice(-8).toUpperCase(), userId, hospitalId,
      situationType: 'accident', category: 'accident_injury', reportedAt: new Date(), location: 'Test pickup',
      latitude: 26.9124, longitude: 75.7873, status: 'AMBULANCE_COORDINATION',
      ambulanceId, ambulanceProviderId: providerId, driverId,
    });
    await TripModel.create({
      _id: tripId, emergencyRequestId: emergencyId, providerId, ambulanceId, driverId,
      destinationHospitalId: hospitalId, status: 'ACCEPTED', acceptedAt: new Date(),
    });

    const { app } = await import('./app.js');
    const { initializeTrackingSockets } = await import('./services/trackingSocketService.js');
    const { broadcastEvent } = await import('./services/realtimeService.js');
    const { updateDriverLocation } = await import('./services/driverDutyService.js');
    server = createServer(app);
    stopSockets = initializeTrackingSockets(server);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test HTTP server did not bind a TCP port.');
    const url = 'http://127.0.0.1:' + address.port;
    const userToken = accessToken(userId, 'tracking-user-' + suffix + '@example.test', 'USER');
    const hospitalToken = accessToken(hospitalId, 'tracking-hospital-' + suffix + '@example.test', 'HOSPITAL');
    const outsiderToken = accessToken(outsiderId, 'tracking-outsider-' + suffix + '@example.test', 'USER');
    const userSocket = await connect(url, userToken); sockets.push(userSocket);
    const hospitalSocket = await connect(url, hospitalToken); sockets.push(hospitalSocket);
    const outsiderSocket = await connect(url, outsiderToken); sockets.push(outsiderSocket);

    assert.equal((await subscribe(userSocket, { type: 'emergency', id: String(emergencyId) })).ok, true);
    assert.equal((await subscribe(hospitalSocket, { type: 'emergency', id: String(emergencyId) })).ok, true);
    assert.equal((await subscribe(hospitalSocket, { type: 'hospital-operations', id: String(hospitalId) })).ok, true);
    const denied = await subscribe(outsiderSocket, { type: 'emergency', id: String(emergencyId) });
    assert.equal(denied.ok, false, 'unrelated user must not join the emergency room');
    assert.equal((await subscribe(userSocket, { type: '*', id: '*' })).ok, false, 'wildcard room subscription must be rejected');

    const userSnapshotResponse = await fetch(url + '/api/v1/tracking/emergencies/' + emergencyId, { headers: { Cookie: 'resq_access_token=' + encodeURIComponent(userToken) } });
    const hospitalSnapshotResponse = await fetch(url + '/api/v1/tracking/emergencies/' + emergencyId, { headers: { Cookie: 'resq_access_token=' + encodeURIComponent(hospitalToken) } });
    assert.equal(userSnapshotResponse.status, 200);
    assert.equal(hospitalSnapshotResponse.status, 200);
    const userSnapshot = (await userSnapshotResponse.json() as { data: { trip: { status: string }; location: { updatedAt: string } } }).data;
    const hospitalSnapshot = (await hospitalSnapshotResponse.json() as { data: { trip: { status: string }; location: { updatedAt: string } } }).data;
    assert.equal(userSnapshot.trip.status, hospitalSnapshot.trip.status);
    assert.equal(userSnapshot.location.updatedAt, hospitalSnapshot.location.updatedAt, 'user and hospital snapshots must share the persisted GPS timestamp');

    const userLocation = new Promise<{ data: Record<string, unknown> }>((resolve) => userSocket.once('tracking:location', resolve));
    const hospitalLocation = new Promise<{ data: Record<string, unknown> }>((resolve) => hospitalSocket.once('tracking:location', resolve));
    const telemetry = await updateDriverLocation(String(driverId), {
      latitude: 26.91241, longitude: 75.78731, accuracy: 6, timestamp: new Date(),
    });
    const [userEnvelope, hospitalEnvelope] = await Promise.all([userLocation, hospitalLocation]);
    assert.deepEqual(userEnvelope.data, hospitalEnvelope.data, 'user and hospital receive the same authoritative GPS payload');
    assert.equal(userEnvelope.data.latitude, telemetry.latitude);
    assert.equal(userEnvelope.data.longitude, telemetry.longitude);
    assert.equal(userEnvelope.data.tripId, String(tripId));
    assert.equal(userEnvelope.data.coordinatesAreLive, true);

    const userAfter = await fetch(url + '/api/v1/tracking/emergencies/' + emergencyId, { headers: { Cookie: 'resq_access_token=' + encodeURIComponent(userToken) } });
    const hospitalAfter = await fetch(url + '/api/v1/tracking/emergencies/' + emergencyId, { headers: { Cookie: 'resq_access_token=' + encodeURIComponent(hospitalToken) } });
    const userAfterSnapshot = (await userAfter.json() as { data: { trip: { status: string }; location: { updatedAt: string; latitude: number; longitude: number } } }).data;
    const hospitalAfterSnapshot = (await hospitalAfter.json() as { data: { trip: { status: string }; location: { updatedAt: string; latitude: number; longitude: number } } }).data;
    assert.equal(userAfterSnapshot.trip.status, hospitalAfterSnapshot.trip.status);
    assert.equal(userAfterSnapshot.location.updatedAt, hospitalAfterSnapshot.location.updatedAt);
    assert.equal(userAfterSnapshot.location.latitude, telemetry.latitude);
    assert.equal(hospitalAfterSnapshot.location.longitude, telemetry.longitude);
    assert.equal(userAfterSnapshot.location.updatedAt, String(telemetry.locationUpdatedAt instanceof Date ? telemetry.locationUpdatedAt.toISOString() : telemetry.locationUpdatedAt));

    let outsiderReceived = false;
    outsiderSocket.on('tracking:location', () => { outsiderReceived = true; });
    await delay(100);
    assert.equal(outsiderReceived, false, 'GPS must not leak to an unrelated user');
    assert.equal((await subscribe(userSocket, { type: 'trip', id: String(tripId) })).ok, true, 'authorized user may explicitly subscribe to their trip');
    const terminalStatus = new Promise<{ data: { status: string } }>((resolve) => userSocket.once('tracking:status', resolve));
    broadcastEvent('trip:' + tripId, 'tracking:status', { id: String(tripId), emergencyRequestId: String(emergencyId), status: 'COMPLETED' });
    assert.equal((await terminalStatus).data.status, 'COMPLETED');
    await delay(50);
    let tripRoomLocationReceived = false;
    userSocket.on('tracking:location', () => { tripRoomLocationReceived = true; });
    broadcastEvent('trip:' + tripId, 'tracking:location', { emergencyRequestId: String(emergencyId), tripId: String(tripId), latitude: telemetry.latitude, longitude: telemetry.longitude, coordinatesAreLive: false });
    await delay(100);
    assert.equal(tripRoomLocationReceived, false, 'trip room is cleaned after terminal status delivery');

    const reconnectingSocket = await connect(url, userToken); sockets.push(reconnectingSocket);
    assert.equal((await subscribe(reconnectingSocket, { type: 'emergency', id: String(emergencyId) })).ok, true);
    const recovered = await fetch(url + '/api/v1/tracking/emergencies/' + emergencyId, { headers: { Cookie: 'resq_access_token=' + encodeURIComponent(userToken) } });
    assert.equal(recovered.status, 200, 'REST snapshot recovers authoritative state after reconnect');
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    if (stopSockets) await stopSockets();
    else if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await Promise.all([
      TripModel.deleteMany({ _id: tripId }),
      EmergencyRequestModel.deleteMany({ _id: emergencyId }),
      AmbulanceDriverModel.deleteMany({ _id: driverId }),
      AmbulanceModel.deleteMany({ _id: ambulanceId }),
      AmbulanceProviderModel.deleteMany({ _id: providerId }),
      HospitalModel.deleteMany({ _id: hospitalId }),
      UserModel.deleteMany({ _id: { $in: [userId, outsiderId] } }),
    ]);
    await mongoose.disconnect();
  }
});
