import test from 'node:test';
import assert from 'node:assert/strict';
import { hospitalProfileUpdateSchema, hospitalEmergencyStatusUpdateSchema, hospitalResourcesUpdateSchema } from './schemas/hospital.js';
import { allowedEmergencyTransition, hospitalOwnershipFilter } from './services/hospitalService.js';

test('hospital profile rejects admin-owned fields', () => {
  const result = hospitalProfileUpdateSchema.safeParse({ accountStatus: 'ACTIVE' });
  assert.equal(result.success, false);
});

test('hospital resource payload requires numeric operational values', () => {
  assert.equal(hospitalResourcesUpdateSchema.safeParse({ resourceSummary: { icu: 4, beds: 12 } }).success, true);
  assert.equal(hospitalResourcesUpdateSchema.safeParse({ resourceSummary: { icu: 'four' } }).success, false);
});

test('emergency status accepts only controlled workflow values', () => {
  assert.equal(hospitalEmergencyStatusUpdateSchema.safeParse({ status: 'REVIEWING' }).success, true);
  assert.equal(hospitalEmergencyStatusUpdateSchema.safeParse({ status: 'ACCEPTED' }).success, false);
});

test('hospital ownership filter is derived from authenticated hospital identity', () => {
  const first = hospitalOwnershipFilter('507f1f77bcf86cd799439011');
  const second = hospitalOwnershipFilter('507f1f77bcf86cd799439012');
  assert.notEqual(String(first.hospitalId), String(second.hospitalId));
  assert.equal(String(first.hospitalId), '507f1f77bcf86cd799439011');
  assert.throws(() => hospitalOwnershipFilter('not-an-id'));
});

test('emergency transition rules allow only the operational state machine', () => {
  assert.deepEqual(allowedEmergencyTransition.RECEIVED, ['REVIEWING', 'CANCELLED']);
  assert.deepEqual(allowedEmergencyTransition.REVIEWING, ['PREPARING', 'CANCELLED']);
  assert.deepEqual(allowedEmergencyTransition.PREPARING, ['AMBULANCE_COORDINATION', 'RESOLVED', 'CANCELLED']);
  assert.deepEqual(allowedEmergencyTransition.AMBULANCE_COORDINATION, ['RESOLVED', 'CANCELLED']);
  assert.deepEqual(allowedEmergencyTransition.RESOLVED, []);
  assert.deepEqual(allowedEmergencyTransition.CANCELLED, []);
  assert.equal(allowedEmergencyTransition.RECEIVED.includes('PREPARING'), false);
  assert.equal(allowedEmergencyTransition.RESOLVED.includes('REVIEWING'), false);
});

test('emergency queue query validates search and bounded pagination', () => {
  const { hospitalEmergencyListQuerySchema } = require('./schemas/hospital.js');
  assert.equal(hospitalEmergencyListQuerySchema.safeParse({ search: 'RSQ-ABC123', page: 1, limit: 50 }).success, true);
  assert.equal(hospitalEmergencyListQuerySchema.safeParse({ page: 0 }).success, false);
  assert.equal(hospitalEmergencyListQuerySchema.safeParse({ limit: 101 }).success, false);
});
