import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocationFreshness, locationUpdateSchema } from './schemas/location.js';
import { allowedEmergencyTransition } from './services/hospitalService.js';

test('location freshness has deterministic operational thresholds', () => {
  const now = Date.parse('2026-10-08T10:00:00.000Z');
  assert.equal(getLocationFreshness(new Date(now - 10_000), now), 'LIVE');
  assert.equal(getLocationFreshness(new Date(now - 30_000), now), 'RECENT');
  assert.equal(getLocationFreshness(new Date(now - 120_000), now), 'RECENT');
  assert.equal(getLocationFreshness(new Date(now - 120_001), now), 'STALE');
  assert.equal(getLocationFreshness(undefined, now), 'UNKNOWN');
});

test('location updates reject invalid coordinates and distant future timestamps', () => {
  assert.equal(locationUpdateSchema.safeParse({
    latitude: 26.9124,
    longitude: 75.7873,
    accuracy: 12,
    timestamp: Date.now(),
  }).success, true);
  assert.equal(locationUpdateSchema.safeParse({
    latitude: 100,
    longitude: 75,
    accuracy: 12,
    timestamp: Date.now(),
  }).success, false);
  assert.equal(locationUpdateSchema.safeParse({
    latitude: 26.9124,
    longitude: 75.7873,
    accuracy: 12,
    timestamp: Date.now() + 10 * 60 * 1000,
  }).success, false);
});

test('terminal emergency states remain closed', () => {
  assert.deepEqual(allowedEmergencyTransition.RESOLVED, []);
  assert.deepEqual(allowedEmergencyTransition.CANCELLED, []);
});
