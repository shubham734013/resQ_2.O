import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import type { AuthenticatedIdentity } from './types/auth.js';
process.env.NODE_ENV ??= 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/resq_test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-that-is-long-enough';
process.env.RESQ_ADMIN_EMAIL ??= 'admin@example.test';
process.env.RESQ_ADMIN_PASSWORD ??= 'test-only-password-long';
const { canAccessTrackingSnapshot, routeTargetForTripStatus, trackingLocationIsFresh } = await import('./services/trackingService.js');

const identity = (id: string, role: AuthenticatedIdentity['role']): AuthenticatedIdentity => ({
  id, email: role.toLowerCase() + '@example.test', role, accountStatus: 'ACTIVE',
});
const objectId = () => new Types.ObjectId();

test('tracking snapshot authorization scopes user, hospital, driver and provider to their own emergency', () => {
  const userId = objectId();
  const hospitalId = objectId();
  const providerId = objectId();
  const driverId = objectId();
  const otherId = objectId();
  const emergency = { _id: objectId(), userId, hospitalId, ambulanceProviderId: providerId };
  const trip = { providerId, driverId, destinationHospitalId: hospitalId };

  assert.equal(canAccessTrackingSnapshot(identity(String(userId), 'USER'), emergency, trip), true);
  assert.equal(canAccessTrackingSnapshot(identity(String(hospitalId), 'HOSPITAL'), emergency, trip), true);
  assert.equal(canAccessTrackingSnapshot(identity(String(driverId), 'AMBULANCE_DRIVER'), emergency, trip), true);
  assert.equal(canAccessTrackingSnapshot(identity(String(providerId), 'AMBULANCE_PROVIDER'), emergency, trip), true);
  assert.equal(canAccessTrackingSnapshot(identity(String(otherId), 'USER'), emergency, trip), false);
  assert.equal(canAccessTrackingSnapshot(identity(String(otherId), 'HOSPITAL'), emergency, trip), false);
  assert.equal(canAccessTrackingSnapshot(identity(String(otherId), 'AMBULANCE_DRIVER'), emergency, trip), false);
  assert.equal(canAccessTrackingSnapshot(identity(String(otherId), 'AMBULANCE_PROVIDER'), emergency, trip), false);
  assert.equal(canAccessTrackingSnapshot(identity(String(otherId), 'ADMIN'), emergency, trip), true);
});

test('previously assigned provider loses tracking access once a trip belongs to another provider', () => {
  const oldProviderId = objectId();
  const activeProviderId = objectId();
  const emergency = { _id: objectId(), userId: objectId(), hospitalId: objectId(), ambulanceProviderId: oldProviderId };
  const trip = { providerId: activeProviderId, driverId: objectId(), destinationHospitalId: emergency.hospitalId };
  assert.equal(canAccessTrackingSnapshot(identity(String(oldProviderId), 'AMBULANCE_PROVIDER'), emergency, trip), false);
  assert.equal(canAccessTrackingSnapshot(identity(String(activeProviderId), 'AMBULANCE_PROVIDER'), emergency, trip), true);
});

test('before acceptance user and destination hospital may see dispatch status, but no driver can read trip tracking', () => {
  const emergency = { _id: objectId(), userId: objectId(), hospitalId: objectId(), ambulanceProviderId: objectId() };
  assert.equal(canAccessTrackingSnapshot(identity(String(emergency.userId), 'USER'), emergency, null), true);
  assert.equal(canAccessTrackingSnapshot(identity(String(emergency.hospitalId), 'HOSPITAL'), emergency, null), true);
  assert.equal(canAccessTrackingSnapshot(identity(String(objectId()), 'AMBULANCE_DRIVER'), emergency, null), false);
});

test('route target follows persisted trip lifecycle rather than browser navigation state', () => {
  assert.equal(routeTargetForTripStatus('ACCEPTED'), 'PICKUP');
  assert.equal(routeTargetForTripStatus('TO_PICKUP'), 'PICKUP');
  assert.equal(routeTargetForTripStatus('AT_PICKUP'), 'PICKUP');
  assert.equal(routeTargetForTripStatus('PATIENT_ONBOARD'), 'HOSPITAL');
  assert.equal(routeTargetForTripStatus('TO_HOSPITAL'), 'HOSPITAL');
  assert.equal(routeTargetForTripStatus('AT_HOSPITAL'), 'HOSPITAL');
});

test('tracking freshness rejects missing, stale and future timestamps', () => {
  const now = new Date('2026-10-10T10:00:00.000Z');
  assert.equal(trackingLocationIsFresh(new Date(now.getTime() - 4000), now), true);
  assert.equal(trackingLocationIsFresh(new Date(now.getTime() - 60000), now), false);
  assert.equal(trackingLocationIsFresh(new Date(now.getTime() + 1000), now), false);
  assert.equal(trackingLocationIsFresh(undefined, now), false);
});
