import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmergencyRequestSchema, emergencyDiscoveryQuerySchema } from './schemas/emergency.js';
import { HOSPITAL_EMERGENCY_STATUSES } from './models/EmergencyRequest.js';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/resq_test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-that-is-long-enough';
process.env.RESQ_ADMIN_EMAIL ??= 'admin@example.test';
process.env.RESQ_ADMIN_PASSWORD ??= 'test-only-password-long';
const { hospitalMatchesSituation } = await import('./services/emergencyService.js');

const validRequest = {
  hospitalId: '507f1f77bcf86cd799439011',
  situationType: 'Chest Pain',
  location: 'Pickup location',
  latitude: 26.9124,
  longitude: 75.7873,
};

test('SOS creation validates category when supplied and requires valid confirmed coordinates', () => {
  assert.equal(createEmergencyRequestSchema.safeParse(validRequest).success, true);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...validRequest, latitude: 91 }).success, false);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...validRequest, longitude: -181 }).success, false);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...validRequest, latitude: undefined }).success, false);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...validRequest, situationType: 'A' }).success, false);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...validRequest, category: 'not-a-category' }).success, false);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...validRequest, category: 'stroke_symptoms' }).success, false);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...validRequest, category: 'chest_pain' }).success, true);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...validRequest, hospitalId: 'bad-id' }).success, false);
});

test('SOS discovery validates location, category, radius and route-refresh option', () => {
  const query = emergencyDiscoveryQuerySchema.parse({
    latitude: '26.9124',
    longitude: '75.7873',
    category: 'chest_pain',
    radiusMeters: '30000',
    includeRoutes: 'false',
  });
  assert.equal(query.latitude, 26.9124);
  assert.equal(query.includeRoutes, false);
  assert.equal(emergencyDiscoveryQuerySchema.safeParse({ latitude: '91', longitude: '75', category: 'other' }).success, false);
  assert.equal(emergencyDiscoveryQuerySchema.safeParse({ latitude: '26', longitude: '75', category: 'not-a-category' }).success, false);
  assert.equal(emergencyDiscoveryQuerySchema.safeParse({ latitude: '26', longitude: '75', category: 'other', radiusMeters: '0' }).success, false);
});

test('hospital capability matching is category-aware', () => {
  assert.equal(hospitalMatchesSituation({ hospitalType: 'General Hospital', services: ['Emergency Department'], capabilities: ['Cardiology & Cath Lab'] }, 'Chest Pain'), true);
  assert.equal(hospitalMatchesSituation({ hospitalType: 'Orthopaedic Clinic', services: ['Bone care'], capabilities: ['Fracture care'] }, 'Chest Pain'), false);
  assert.equal(hospitalMatchesSituation({ hospitalType: 'Trauma Center', services: ['Trauma Care'], capabilities: [] }, 'Accident / Injury'), true);
});

test('SOS reuses the existing emergency status enum', () => {
  assert.deepEqual(HOSPITAL_EMERGENCY_STATUSES, ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION', 'RESOLVED', 'CANCELLED']);
});
