import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { getLocationFreshness, locationUpdateSchema } from './schemas/location.js';
import { allowedEmergencyTransition } from './services/hospitalService.js';
import { validateBody, validateQuery } from './middlewares/validate.js';
import type { NextFunction, Request, Response } from 'express';

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

test('validateBody populates both req.body and res.locals.validatedBody', () => {
  const schema = z.object({ name: z.string(), age: z.number() });
  const middleware = validateBody(schema);

  const req = { body: { name: 'ResQ User', age: 30 } } as unknown as Request;
  const res = { locals: {} } as unknown as Response;
  let nextCalled = false;
  let nextError: unknown = null;

  const nextFn: NextFunction = (err?: unknown) => {
    nextCalled = true;
    nextError = err;
  };
  middleware(req, res, nextFn);

  assert.equal(nextCalled, true);
  assert.equal(nextError, undefined);
  assert.deepEqual(req.body, { name: 'ResQ User', age: 30 });
  assert.deepEqual(res.locals.validatedBody, { name: 'ResQ User', age: 30 });

  // Test validation error handling
  const badReq = { body: { name: 'ResQ User', age: 'invalid' } } as unknown as Request;
  const badRes = { locals: {} } as unknown as Response;
  let badNextCalled = false;
  let badNextError: unknown = null;

  const badNextFn: NextFunction = (err?: unknown) => {
    badNextCalled = true;
    badNextError = err;
  };
  middleware(badReq, badRes, badNextFn);

  assert.equal(badNextCalled, true);
  assert.ok(badNextError instanceof Error);
  const err = badNextError as Error & { statusCode: number; code: string };
  assert.equal(err.statusCode, 400);
  assert.equal(err.code, 'VALIDATION_ERROR');

  // Test validateQuery populates res.locals.validatedQuery
  const querySchema = z.object({ page: z.coerce.number() });
  const queryMiddleware = validateQuery(querySchema);
  const qReq = { query: { page: '2' } } as unknown as Request;
  const qRes = { locals: {} } as unknown as Response;
  let qNextCalled = false;

  const qNextFn: NextFunction = () => {
    qNextCalled = true;
  };
  queryMiddleware(qReq, qRes, qNextFn);

  assert.equal(qNextCalled, true);
  assert.deepEqual(qRes.locals.validatedQuery, { page: 2 });
});

