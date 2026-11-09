import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV ??= 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/resq_test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-that-is-long-enough';
process.env.RESQ_ADMIN_EMAIL ??= 'admin@example.test';
process.env.RESQ_ADMIN_PASSWORD ??= 'test-only-password-long';
process.env.DRIVER_LOCATION_UPDATE_INTERVAL_MS ??= '4000';
process.env.DRIVER_LOCATION_STALE_AFTER_MS ??= '15000';
process.env.DRIVER_LOCATION_MAX_AGE_MS ??= '30000';

const duty = await import('./services/driverDutyService.js');
const { ambulanceLocationUpdateSchema } = await import('./schemas/ambulance.js');

test('existing availability enums map to duty states without adding duplicate enums', () => {
  assert.equal(duty.driverDutyStateForAvailability('OFFLINE'), 'OFF_DUTY');
  assert.equal(duty.driverDutyStateForAvailability('ONLINE'), 'AVAILABLE');
  assert.equal(duty.driverDutyStateForAvailability('BUSY'), 'BUSY');
});

test('location payload rejects invalid coordinates, accuracy, and missing timestamps', () => {
  const valid = { latitude: 26.9124, longitude: 75.7873, accuracy: 8, timestamp: Date.now() };
  assert.equal(ambulanceLocationUpdateSchema.safeParse(valid).success, true);
  assert.equal(ambulanceLocationUpdateSchema.safeParse({ ...valid, latitude: 91 }).success, false);
  assert.equal(ambulanceLocationUpdateSchema.safeParse({ ...valid, longitude: -181 }).success, false);
  assert.equal(ambulanceLocationUpdateSchema.safeParse({ ...valid, accuracy: 1001 }).success, false);
  assert.equal(ambulanceLocationUpdateSchema.safeParse({ ...valid, unexpected: true }).success, false);
});

test('GPS timestamps reject stale and future-dated fixes', () => {
  const now = new Date('2026-10-10T10:00:00.000Z');
  assert.doesNotThrow(() => duty.validateLocationTimestamp(new Date(now.getTime() - 1000), now));
  assert.throws(() => duty.validateLocationTimestamp(new Date(now.getTime() - 30001), now), /too old/i);
  assert.throws(() => duty.validateLocationTimestamp(new Date(now.getTime() + 6000), now), /ahead of the server clock/i);
});

test('freshness is explicit and stale GPS is never reported as fresh', () => {
  const now = new Date('2026-10-10T10:00:00.000Z');
  assert.equal(duty.locationFreshnessFor(new Date(now.getTime() - 5000), now), 'FRESH');
  assert.equal(duty.locationFreshnessFor(new Date(now.getTime() - 16000), now), 'STALE');
  assert.equal(duty.locationFreshnessFor(undefined, now), 'STALE');
});

test('GPS movement guard accepts plausible movement and rejects implausible jumps', () => {
  const now = new Date('2026-10-10T10:00:04.000Z');
  const previous = { latitude: 26.9124, longitude: 75.7873, timestamp: new Date(now.getTime() - 4000), accuracy: 8 };
  const plausible = { latitude: 26.9125, longitude: 75.7874, accuracy: 8, timestamp: now };
  const teleport = { latitude: 26.95, longitude: 75.82, accuracy: 8, timestamp: now };
  assert.equal(duty.isPlausibleLocationJump(previous, plausible, now), true);
  assert.equal(duty.isPlausibleLocationJump(previous, teleport, now), false);
  assert.equal(duty.isPlausibleLocationJump(previous, { ...plausible, timestamp: previous.timestamp }, now), false);
});
