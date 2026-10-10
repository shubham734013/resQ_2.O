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
import { HospitalPatientModel } from './models/HospitalPatient.js';
import { DispatchJobModel } from './models/DispatchJob.js';
import { HospitalCoordinationNotificationModel } from './models/HospitalCoordinationNotification.js';

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
  const otherHospitalId = new Types.ObjectId();
  const providerId = new Types.ObjectId();
  const ambulanceId = new Types.ObjectId();
  const driverId = new Types.ObjectId();
  const secondAmbulanceId = new Types.ObjectId();
  const secondDriverId = new Types.ObjectId();
  const emergencyId = new Types.ObjectId();
  const tripId = new Types.ObjectId();
  let secondTripId = new Types.ObjectId();
  const dispatchJobId = new Types.ObjectId();
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
      hospitalType: 'Emergency', services: ['Emergency', 'Trauma'], capabilities: ['Emergency', 'Trauma'],
      emergencyAvailability: 'AVAILABLE', latitude: 26.9128, longitude: 75.7875,
      verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await HospitalModel.create({
      _id: otherHospitalId, name: 'Other Tracking Hospital', registrationNumber: 'OTH-' + suffix,
      email: 'other-tracking-hospital-' + suffix + '@example.test', phone: '0000000000', passwordHash: 'test-only',
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
      providerId, ambulanceType: 'ALS', capabilities: ['Emergency'], currentStatus: 'AVAILABLE',
      verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE', currentLatitude: 26.9124, currentLongitude: 75.7873,
      location: { type: 'Point', coordinates: [75.7873, 26.9124] }, locationUpdatedAt: new Date(Date.now() - 5000),
      locationSourceTimestamp: new Date(Date.now() - 5000), locationAccuracyMeters: 7,
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
    await HospitalPatientModel.create({
      caseId: 'TRKC-' + suffix.slice(-8).toUpperCase(), hospitalId, emergencyId, ambulanceId,
      coordinationStatus: 'INCOMING', emergencyType: 'accident', receivedAt: new Date(),
    });
    const now = new Date();
    const attemptId = 'acceptance-' + suffix;
    await DispatchJobModel.create({
      _id: dispatchJobId, emergencyRequestId: emergencyId, hospitalId, userId, category: 'accident_injury',
      pickupLatitude: 26.9124, pickupLongitude: 75.7873, status: 'ACCEPTED', generation: 1,
      attempts: [{ attemptId, generation: 1, attemptNumber: 1, providerId, ambulanceId, driverId, status: 'ACCEPTED',
        offeredAt: new Date(now.getTime() - 30000), deadlineAt: new Date(now.getTime() - 5000), respondedAt: now,
        routeSource: 'DRIVING', routeDistanceMeters: 0 }],
      events: [], currentAttemptId: attemptId, currentProviderId: providerId, currentAmbulanceId: ambulanceId,
      currentDriverId: driverId, acceptedTripId: tripId,
    });

    const { app } = await import('./app.js');
    const { initializeTrackingSockets } = await import('./services/trackingSocketService.js');
    const { broadcastEvent } = await import('./services/realtimeService.js');
    const { updateDriverLocation } = await import('./services/driverDutyService.js');
    const { arrivedPickup, patientPickedUp, arrivedHospital, completeTrip, cancelTrip } = await import('./services/ambulanceOperationsService.js');
    const { recordHospitalCoordinationEvent } = await import('./services/hospitalCoordinationService.js');
    server = createServer(app);
    stopSockets = initializeTrackingSockets(server);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test HTTP server did not bind a TCP port.');
    const url = 'http://127.0.0.1:' + address.port;
    const userToken = accessToken(userId, 'tracking-user-' + suffix + '@example.test', 'USER');
    const hospitalToken = accessToken(hospitalId, 'tracking-hospital-' + suffix + '@example.test', 'HOSPITAL');
    const otherHospitalToken = accessToken(otherHospitalId, 'other-tracking-hospital-' + suffix + '@example.test', 'HOSPITAL');
    const outsiderToken = accessToken(outsiderId, 'tracking-outsider-' + suffix + '@example.test', 'USER');
    const userSocket = await connect(url, userToken); sockets.push(userSocket);
    const hospitalSocket = await connect(url, hospitalToken); sockets.push(hospitalSocket);
    const hospitalSecondSocket = await connect(url, hospitalToken); sockets.push(hospitalSecondSocket);
    const outsiderSocket = await connect(url, outsiderToken); sockets.push(outsiderSocket);

    assert.equal((await subscribe(userSocket, { type: 'emergency', id: String(emergencyId) })).ok, true);
    assert.equal((await subscribe(hospitalSocket, { type: 'emergency', id: String(emergencyId) })).ok, true);
    assert.equal((await subscribe(hospitalSocket, { type: 'hospital-operations', id: String(hospitalId) })).ok, true);
    assert.equal((await subscribe(hospitalSecondSocket, { type: 'hospital-operations', id: String(hospitalId) })).ok, true, 'multiple authenticated hospital sessions can subscribe to the same hospital room');
    const denied = await subscribe(outsiderSocket, { type: 'emergency', id: String(emergencyId) });
    assert.equal(denied.ok, false, 'unrelated user must not join the emergency room');
    assert.equal((await subscribe(userSocket, { type: '*', id: '*' })).ok, false, 'wildcard room subscription must be rejected');

    await TripModel.updateOne({ _id: tripId }, { $set: { status: 'ASSIGNED' }, $unset: { acceptedAt: 1 } });
    const preAcceptanceResponse = await fetch(url + '/api/v1/tracking/emergencies/' + emergencyId, { headers: { Cookie: 'resq_access_token=' + encodeURIComponent(userToken) } });
    assert.equal(preAcceptanceResponse.status, 200);
    const preAcceptance = (await preAcceptanceResponse.json() as { data: { trip: { status: string }; ambulance: unknown; location: unknown; trackingActive: boolean } }).data;
    assert.equal(preAcceptance.trip.status, 'ASSIGNED');
    assert.equal(preAcceptance.ambulance, null, 'vehicle identity must remain hidden before driver acceptance');
    assert.equal(preAcceptance.location, null, 'GPS must remain hidden before driver acceptance');
    assert.equal(preAcceptance.trackingActive, false);

    await TripModel.updateOne({ _id: tripId }, { $set: { status: 'ACCEPTED', acceptedAt: new Date() } });
    const userSnapshotResponse = await fetch(url + '/api/v1/tracking/emergencies/' + emergencyId, { headers: { Cookie: 'resq_access_token=' + encodeURIComponent(userToken) } });
    const hospitalSnapshotResponse = await fetch(url + '/api/v1/tracking/emergencies/' + emergencyId, { headers: { Cookie: 'resq_access_token=' + encodeURIComponent(hospitalToken) } });
    assert.equal(userSnapshotResponse.status, 200);
    assert.equal(hospitalSnapshotResponse.status, 200);
    const userSnapshot = (await userSnapshotResponse.json() as { data: { trip: { status: string }; location: { updatedAt: string } } }).data;
    const hospitalSnapshot = (await hospitalSnapshotResponse.json() as { data: { trip: { status: string }; location: { updatedAt: string } } }).data;
    assert.equal(userSnapshot.trip.status, hospitalSnapshot.trip.status);
    assert.equal(userSnapshot.location.updatedAt, hospitalSnapshot.location.updatedAt, 'user and hospital snapshots must share the persisted GPS timestamp');
    const firstHospitalNotification = new Promise<{ channel: string; event: string; data: { id: string; type: string }; timestamp: string }>((resolve) => hospitalSocket.once('hospital:coordination-notification', resolve));
    const secondHospitalNotification = new Promise<{ channel: string; event: string; data: { id: string; type: string }; timestamp: string }>((resolve) => hospitalSecondSocket.once('hospital:coordination-notification', resolve));
    const firstPersistedAlert = await recordHospitalCoordinationEvent({ emergencyId: String(emergencyId), tripId: String(tripId), type: 'AMBULANCE_ASSIGNED' });
    const duplicatePersistedAlert = await recordHospitalCoordinationEvent({ emergencyId: String(emergencyId), tripId: String(tripId), type: 'AMBULANCE_ASSIGNED' });
    assert.equal(firstPersistedAlert?.id, duplicatePersistedAlert?.id, 'duplicate lifecycle events must reuse the same notification record');
    assert.equal(await HospitalCoordinationNotificationModel.countDocuments({ emergencyId, type: 'AMBULANCE_ASSIGNED' }), 1, 'unique notification record is persisted exactly once');
    const [firstNotice, secondNotice] = await Promise.all([firstHospitalNotification, secondHospitalNotification]);
    assert.equal(firstNotice.data.id, firstPersistedAlert?.id);
    assert.equal(secondNotice.data.id, firstPersistedAlert?.id, 'all active sessions for this hospital receive the persisted event');
    assert.equal((await HospitalPatientModel.findOne({ emergencyId }).lean().exec())?.coordinationStatus, 'HOSPITAL_NOTIFIED');

    const hospitalCookie = { Cookie: 'resq_access_token=' + encodeURIComponent(hospitalToken) };
    const inboxFirst = await fetch(url + '/api/v1/hospital/coordination/notifications?state=UNREAD', { headers: hospitalCookie });
    assert.equal(inboxFirst.status, 200);
    const inboxFirstData = (await inboxFirst.json() as { data: { items: Array<{ id: string; type: string; state: string }>; unreadCount: number } }).data;
    assert.equal(inboxFirstData.items.filter((item) => item.id === firstPersistedAlert?.id).length, 1);
    assert.ok(inboxFirstData.unreadCount >= 1, 'persisted unread count is available independently of realtime delivery');
    const inboxRefresh = await fetch(url + '/api/v1/hospital/coordination/notifications?state=UNREAD', { headers: hospitalCookie });
    const inboxRefreshData = (await inboxRefresh.json() as { data: { items: Array<{ id: string }> } }).data;
    assert.equal(inboxRefreshData.items.filter((item) => item.id === firstPersistedAlert?.id).length, 1, 'browser refresh recovers the same record without creating duplicates');

    const otherHospitalCookie = { Cookie: 'resq_access_token=' + encodeURIComponent(otherHospitalToken) };
    const crossHospitalDetail = await fetch(url + '/api/v1/hospital/coordination/emergencies/' + emergencyId, { headers: otherHospitalCookie });
    assert.equal(crossHospitalDetail.status, 404, 'another hospital cannot read this emergency detail');
    const crossHospitalAck = await fetch(url + '/api/v1/hospital/coordination/notifications/' + firstPersistedAlert?.id + '/acknowledge', { method: 'POST', headers: { ...otherHospitalCookie, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(crossHospitalAck.status, 404, 'another hospital cannot acknowledge this notification');
    const acknowledged = await fetch(url + '/api/v1/hospital/coordination/notifications/' + firstPersistedAlert?.id + '/acknowledge', { method: 'POST', headers: { ...hospitalCookie, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(acknowledged.status, 200);
    assert.equal(((await acknowledged.json() as { data: { state: string } }).data).state, 'ACKNOWLEDGED');
    const inboxAfterAck = await fetch(url + '/api/v1/hospital/coordination/notifications?state=ALL', { headers: hospitalCookie });
    const inboxAfterAckData = (await inboxAfterAck.json() as { data: { items: Array<{ id: string; state: string }> } }).data;
    assert.equal(inboxAfterAckData.items.find((item) => item.id === firstPersistedAlert?.id)?.state, 'ACKNOWLEDGED', 'acknowledgement state survives a refresh');


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

    // Simulate a driver cancelling before transport. The old trip is terminal, its resources are released,
    // the hospital case returns to a reassignment-required state, and dispatch is durably requeued.
    hospitalSocket.disconnect();
    hospitalSecondSocket.disconnect();
    await cancelTrip(String(driverId), String(tripId));
    assert.equal((await TripModel.findById(tripId).lean().exec())?.status, 'CANCELLED');
    assert.equal((await HospitalPatientModel.findOne({ emergencyId }).lean().exec())?.coordinationStatus, 'REASSIGNMENT_REQUIRED');
    assert.equal((await DispatchJobModel.findById(dispatchJobId).lean().exec())?.status, 'PENDING');
    assert.equal(await HospitalCoordinationNotificationModel.countDocuments({ emergencyId, type: 'TRIP_CANCELLED' }), 1, 'cancellation notification persists even with hospital sockets disconnected');
    assert.equal((await subscribe(userSocket, { type: 'trip', id: String(tripId) })).ok, false, 'cancelled trip cannot be resubscribed');

    // A replacement ambulance is accepted for the same emergency; its assignment must supersede the stale cancellation alert.
    await AmbulanceModel.updateOne({ _id: ambulanceId }, { $set: { currentStatus: 'MAINTENANCE' } });
    await AmbulanceModel.create({
      _id: secondAmbulanceId, registrationNumber: 'TRB-' + suffix, vehicleNumber: 'TRW-' + suffix,
      providerId, ambulanceType: 'ALS', capabilities: ['Emergency'], currentStatus: 'BUSY',
      verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE', currentLatitude: 26.9124, currentLongitude: 75.7873,
      location: { type: 'Point', coordinates: [75.7873, 26.9124] }, locationUpdatedAt: new Date(Date.now() - 5000),
      locationSourceTimestamp: new Date(Date.now() - 5000), locationAccuracyMeters: 7,
    });
    await AmbulanceDriverModel.create({
      _id: secondDriverId, fullName: 'Replacement Tracking Driver', email: 'replacement-driver-' + suffix + '@example.test',
      phone: '0000000000', passwordHash: 'test-only', authProvider: 'LOCAL', licenseNumber: 'TRW-L-' + suffix,
      providerId, assignedAmbulanceId: secondAmbulanceId, availabilityStatus: 'ONLINE', profileCompletionStatus: 'COMPLETE',
      licenseVerificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    const { processDispatchTick, acceptDispatchOffer } = await import('./services/dispatchService.js');
    await processDispatchTick();
    const offeredJob = await DispatchJobModel.findById(dispatchJobId).lean().exec();
    assert.equal(offeredJob?.status, 'OFFERED', 'cancelled pre-transport trips return the emergency to automatic dispatch');
    assert.equal(String(offeredJob?.currentDriverId), String(secondDriverId), 'dispatch must offer the replacement ambulance, not the unavailable old vehicle');
    const acceptedReplacement = await acceptDispatchOffer(String(secondDriverId), String(dispatchJobId));
    secondTripId = new Types.ObjectId(acceptedReplacement.tripId);
    assert.equal(acceptedReplacement.status, 'ACCEPTED');
    const reassignedTrip = await TripModel.findById(secondTripId).lean().exec();
    assert.equal(String(reassignedTrip?.ambulanceId), String(secondAmbulanceId));
    const reassignedAlert = await HospitalCoordinationNotificationModel.findOne({ emergencyId, type: 'AMBULANCE_REASSIGNED' }).lean().exec();
    assert.ok(reassignedAlert, 'the replacement acceptance persists a reassignment notification');
    assert.equal(await HospitalCoordinationNotificationModel.countDocuments({ emergencyId, type: 'AMBULANCE_REASSIGNED' }), 1);
    assert.equal((await HospitalPatientModel.findOne({ emergencyId }).lean().exec())?.coordinationStatus, 'HOSPITAL_NOTIFIED');
    assert.equal(await HospitalCoordinationNotificationModel.countDocuments({ emergencyId, type: 'AMBULANCE_REASSIGNED' }), 1);

    // Refresh/reconnect recovery uses the persisted inbox, not an in-memory socket queue.
    const hospitalRecoverySocket = await connect(url, hospitalToken); sockets.push(hospitalRecoverySocket);
    const hospitalSecondRecoverySocket = await connect(url, hospitalToken); sockets.push(hospitalSecondRecoverySocket);
    assert.equal((await subscribe(hospitalRecoverySocket, { type: 'hospital-operations', id: String(hospitalId) })).ok, true);
    assert.equal((await subscribe(hospitalSecondRecoverySocket, { type: 'hospital-operations', id: String(hospitalId) })).ok, true);
    const recoveredInbox = await fetch(url + '/api/v1/hospital/coordination/notifications?state=ALL', { headers: hospitalCookie });
    assert.equal(recoveredInbox.status, 200);
    const recoveredAlerts = (await recoveredInbox.json() as { data: { items: Array<{ type: string; state: string; ambulanceId?: string }> } }).data.items;
    assert.ok(recoveredAlerts.some((item) => item.type === 'TRIP_CANCELLED' && item.state === 'SUPERSEDED'));
    assert.ok(recoveredAlerts.some((item) => item.type === 'AMBULANCE_REASSIGNED' && item.ambulanceId === String(secondAmbulanceId)));

    const replacementTelemetry = await updateDriverLocation(String(secondDriverId), {
      latitude: 26.91241, longitude: 75.78731, accuracy: 6, timestamp: new Date(),
    });
    assert.equal(replacementTelemetry.ambulanceId, String(secondAmbulanceId));
    const hospitalCoordinationResponse = await fetch(url + '/api/v1/hospital/coordination/emergencies/' + emergencyId, { headers: hospitalCookie });
    assert.equal(hospitalCoordinationResponse.status, 200);
    const hospitalCoordination = (await hospitalCoordinationResponse.json() as { data: { trip: { id: string; status: string }; ambulance: { id: string; location: { coordinatesAreLive: boolean } } } }).data;
    assert.equal(hospitalCoordination.trip.id, String(secondTripId));
    assert.equal(hospitalCoordination.ambulance.id, String(secondAmbulanceId));
    assert.equal(hospitalCoordination.ambulance.location.coordinatesAreLive, true, 'hospital detail exposes current location and freshness only for its own active trip');

    assert.equal((await subscribe(userSocket, { type: 'trip', id: String(secondTripId) })).ok, true);
    await arrivedPickup(String(secondDriverId), String(secondTripId));
    assert.equal(await HospitalCoordinationNotificationModel.countDocuments({ emergencyId, type: 'AMBULANCE_AT_PICKUP' }), 1);
    await patientPickedUp(String(secondDriverId), String(secondTripId));
    assert.equal(await HospitalCoordinationNotificationModel.countDocuments({ emergencyId, type: 'PATIENT_PICKED_UP' }), 1);
    assert.equal(await HospitalCoordinationNotificationModel.countDocuments({ emergencyId, type: 'EN_ROUTE_TO_HOSPITAL' }), 1, 'patient pickup also persists the en-route milestone');
    await arrivedHospital(String(secondDriverId), String(secondTripId));
    assert.equal((await HospitalPatientModel.findOne({ emergencyId }).lean().exec())?.coordinationStatus, 'AT_HOSPITAL', 'hospital coordination changes only after authoritative arrival action');
    assert.equal(await HospitalCoordinationNotificationModel.countDocuments({ emergencyId, type: 'AMBULANCE_ARRIVED' }), 1);
    const terminalStatus = new Promise<{ data: { status: string } }>((resolve) => userSocket.once('tracking:status', resolve));
    await completeTrip(String(secondDriverId), String(secondTripId));
    assert.equal((await terminalStatus).data.status, 'COMPLETED');
    assert.equal((await TripModel.findById(secondTripId).lean().exec())?.status, 'COMPLETED');
    assert.equal((await subscribe(userSocket, { type: 'trip', id: String(secondTripId) })).ok, false, 'terminal trips cannot be resubscribed for live events');
    assert.equal((await AmbulanceModel.findById(secondAmbulanceId).lean().exec())?.currentStatus, 'AVAILABLE');
    assert.equal((await AmbulanceDriverModel.findById(secondDriverId).lean().exec())?.availabilityStatus, 'ONLINE');
    assert.equal((await HospitalPatientModel.findOne({ emergencyId }).lean().exec())?.coordinationStatus, 'RESOLVED');
    assert.equal(await HospitalCoordinationNotificationModel.countDocuments({ emergencyId, type: 'TRIP_COMPLETED' }), 1);
    await delay(50);
    let tripRoomLocationReceived = false;
    userSocket.on('tracking:location', () => { tripRoomLocationReceived = true; });
    broadcastEvent('trip:' + secondTripId, 'tracking:location', { emergencyRequestId: String(emergencyId), tripId: String(secondTripId), latitude: replacementTelemetry.latitude, longitude: replacementTelemetry.longitude, coordinatesAreLive: false });
    await delay(100);
    assert.equal(tripRoomLocationReceived, false, 'trip room is cleaned after terminal status delivery');

    const reconnectingSocket = await connect(url, userToken); sockets.push(reconnectingSocket);
    assert.equal((await subscribe(reconnectingSocket, { type: 'emergency', id: String(emergencyId) })).ok, true);
    const recovered = await fetch(url + '/api/v1/tracking/emergencies/' + emergencyId, { headers: { Cookie: 'resq_access_token=' + encodeURIComponent(userToken) } });
    assert.equal(recovered.status, 200, 'REST snapshot recovers authoritative state after reconnect');
    const recoveredSnapshot = (await recovered.json() as { data: { trackingActive: boolean; trip: { status: string }; location: unknown } }).data;
    assert.equal(recoveredSnapshot.trip.status, 'COMPLETED');
    assert.equal(recoveredSnapshot.trackingActive, false);
    assert.equal(recoveredSnapshot.location, null, 'completed trips must not expose a live or last-known vehicle location');

  } finally {
    sockets.forEach((socket) => socket.disconnect());
    if (stopSockets) await stopSockets();
    else if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await Promise.all([
      TripModel.deleteMany({ _id: { $in: [tripId, secondTripId] } }),
      DispatchJobModel.deleteMany({ _id: dispatchJobId }),
      HospitalCoordinationNotificationModel.deleteMany({ emergencyId }),
      HospitalPatientModel.deleteMany({ emergencyId }),
      EmergencyRequestModel.deleteMany({ _id: emergencyId }),
      AmbulanceDriverModel.deleteMany({ _id: { $in: [driverId, secondDriverId] } }),
      AmbulanceModel.deleteMany({ _id: { $in: [ambulanceId, secondAmbulanceId] } }),
      AmbulanceProviderModel.deleteMany({ _id: providerId }),
      HospitalModel.deleteMany({ _id: { $in: [hospitalId, otherHospitalId] } }),
      UserModel.deleteMany({ _id: { $in: [userId, outsiderId] } }),
    ]);
    await mongoose.disconnect();
  }
});
