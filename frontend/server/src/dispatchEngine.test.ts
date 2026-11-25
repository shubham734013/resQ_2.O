import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
process.env.NODE_ENV ??= 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/resq_test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-that-is-long-enough';
process.env.RESQ_ADMIN_EMAIL ??= 'admin@example.test';
process.env.RESQ_ADMIN_PASSWORD ??= 'test-only-password-long';

const {
  DISPATCH_ALLOWED_TRANSITIONS,
  DISPATCH_LOCATION_FRESHNESS_MS,
  DISPATCH_OFFER_TIMEOUT_MS,
  isAllowedDispatchTransition,
  isDispatchLocationFresh,
  isDispatchOfferAcceptable,
  rankDispatchCandidates,
} = await import('./services/dispatchService.js');
type DispatchCandidate = import('./services/dispatchService.js').DispatchCandidate;

const candidate = (source: 'DRIVING' | 'STRAIGHT_LINE_FALLBACK', distance: number, eta?: number): DispatchCandidate => ({
  providerId: new Types.ObjectId(),
  ambulanceId: new Types.ObjectId(),
  driverId: new Types.ObjectId(),
  coordinates: { latitude: 26.9124, longitude: 75.7873 },
  straightLineMeters: distance,
  route: { source, distanceMeters: distance, etaSeconds: eta },
});

test('dispatch state machine allows only defined lifecycle transitions', () => {
  assert.equal(isAllowedDispatchTransition('PENDING', 'SEARCHING'), true);
  assert.equal(isAllowedDispatchTransition('OFFERED', 'ACCEPTED'), true);
  assert.equal(isAllowedDispatchTransition('OFFERED', 'EXHAUSTED'), false);
  assert.equal(isAllowedDispatchTransition('ACCEPTED', 'PENDING'), true, 'a pre-transport trip cancellation can return the accepted dispatch job to the queue');
  assert.equal(isAllowedDispatchTransition('EXHAUSTED', 'ESCALATED'), true);
  assert.equal(isAllowedDispatchTransition('CANCELLED', 'PENDING'), false);
  assert.deepEqual(DISPATCH_ALLOWED_TRANSITIONS.CANCELLED, []);
});

test('driving ETA ranks ahead of straight-line fallback and route ETA ranks routed candidates', () => {
  const slowDriving = candidate('DRIVING', 9000, 900);
  const fastDriving = candidate('DRIVING', 14000, 420);
  const closeFallback = candidate('STRAIGHT_LINE_FALLBACK', 500, undefined);
  const ranked = rankDispatchCandidates([closeFallback, slowDriving, fastDriving]);
  assert.equal(ranked[0], fastDriving);
  assert.equal(ranked[1], slowDriving);
  assert.equal(ranked[2], closeFallback);
});

test('driver location freshness rejects stale and implausibly future-dated telemetry', () => {
  const now = new Date('2026-10-10T10:00:00.000Z');
  assert.equal(isDispatchLocationFresh(new Date(now.getTime() - Math.floor(DISPATCH_LOCATION_FRESHNESS_MS / 2)), now), true);
  assert.equal(isDispatchLocationFresh(new Date(now.getTime() - DISPATCH_LOCATION_FRESHNESS_MS - 1), now), false);
  assert.equal(isDispatchLocationFresh(new Date(now.getTime() + 10_000), now), false);
  assert.equal(isDispatchLocationFresh(undefined, now), false);
});

test('only an active, unexpired server offer is acceptable', () => {
  const now = new Date();
  assert.equal(isDispatchOfferAcceptable('OFFERED', new Date(now.getTime() + 1000), now), true);
  assert.equal(isDispatchOfferAcceptable('OFFERED', new Date(now.getTime() - 1), now), false);
  assert.equal(isDispatchOfferAcceptable('ACCEPTED', new Date(now.getTime() + 1000), now), false);
  assert.equal(DISPATCH_OFFER_TIMEOUT_MS, 25_000);
});
