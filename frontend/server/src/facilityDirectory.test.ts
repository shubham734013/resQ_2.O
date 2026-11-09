import test from 'node:test';
import assert from 'node:assert/strict';
import { facilitySearchQuerySchema } from './schemas/facility.js';
import { hospitalToFacility } from './services/facilityService.js';

test('facility search requires latitude and longitude together', () => {
  assert.equal(facilitySearchQuerySchema.safeParse({ latitude: '26.9' }).success, false);
  assert.equal(facilitySearchQuerySchema.safeParse({ latitude: '26.9', longitude: '75.8' }).success, true);
});

test('facility search rejects invalid coordinates, radius and pagination', () => {
  assert.equal(facilitySearchQuerySchema.safeParse({ latitude: '91', longitude: '75' }).success, false);
  assert.equal(facilitySearchQuerySchema.safeParse({ latitude: '26', longitude: '75', radiusMeters: '0' }).success, false);
  assert.equal(facilitySearchQuerySchema.safeParse({ page: '0' }).success, false);
  assert.equal(facilitySearchQuerySchema.safeParse({ limit: '101' }).success, false);
});

test('facility search normalizes paging and defaults', () => {
  const parsed = facilitySearchQuerySchema.parse({ page: '2', limit: '10', emergencyOnly: 'true' });
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 10);
  assert.equal(parsed.emergencyOnly, true);
});

test('facility serialization uses valid legacy latitude/longitude if GeoJSON is absent', () => {
  const item = hospitalToFacility({
    _id: { toString: () => '507f1f77bcf86cd799439011' } as never,
    name: 'Hospital',
    hospitalType: 'General',
    services: [],
    capabilities: [],
    emergencyAvailability: 'AVAILABLE',
    verificationStatus: 'VERIFIED',
    accountStatus: 'ACTIVE',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    latitude: 26.9,
    longitude: 75.8,
  });
  assert.equal(item.latitude, 26.9);
  assert.equal(item.longitude, 75.8);
  assert.equal(item.emergencyAvailable, true);
});

test('facility serialization omits invalid coordinates', () => {
  const item = hospitalToFacility({
    _id: { toString: () => '507f1f77bcf86cd799439011' } as never,
    name: 'Hospital',
    hospitalType: 'General',
    services: [],
    capabilities: [],
    emergencyAvailability: 'UNKNOWN',
    verificationStatus: 'PENDING',
    accountStatus: 'PENDING',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    latitude: 999,
    longitude: 75.8,
  });
  assert.equal(item.latitude, undefined);
  assert.equal(item.longitude, 75.8);
  assert.equal(item.emergencyAvailable, false);
});
