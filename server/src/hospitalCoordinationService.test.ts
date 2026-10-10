import test from 'node:test';
import assert from 'node:assert/strict';
import { HospitalCoordinationNotificationModel } from './models/HospitalCoordinationNotification.js';
import { HospitalPatientModel } from './models/HospitalPatient.js';
import { hospitalNotificationTypeForTripStatus } from './services/hospitalCoordinationService.js';

test('trip lifecycle maps to distinct durable hospital milestones', () => {
  assert.equal(hospitalNotificationTypeForTripStatus('ACCEPTED'), 'AMBULANCE_ASSIGNED');
  assert.equal(hospitalNotificationTypeForTripStatus('AT_PICKUP'), 'AMBULANCE_AT_PICKUP');
  assert.equal(hospitalNotificationTypeForTripStatus('PATIENT_ONBOARD'), 'PATIENT_PICKED_UP');
  assert.equal(hospitalNotificationTypeForTripStatus('TO_HOSPITAL'), 'EN_ROUTE_TO_HOSPITAL');
  assert.equal(hospitalNotificationTypeForTripStatus('AT_HOSPITAL'), 'AMBULANCE_ARRIVED');
  assert.equal(hospitalNotificationTypeForTripStatus('COMPLETED'), 'TRIP_COMPLETED');
  assert.equal(hospitalNotificationTypeForTripStatus('CANCELLED'), 'TRIP_CANCELLED');
  assert.equal(hospitalNotificationTypeForTripStatus('ASSIGNED'), null, 'unaccepted assignments must not be reported as accepted');
});

test('hospital notification schema has a unique deduplication key and scoped inbox indexes', () => {
  const indexes = HospitalCoordinationNotificationModel.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => (keys as Record<string, number>).dedupeKey === 1 && (options as { unique?: boolean }).unique === true));
  assert.ok(indexes.some(([keys]) => (keys as Record<string, number>).hospitalId === 1 && (keys as Record<string, number>).state === 1));
});

test('hospital patient coordination supports an explicit reassignment-required state', () => {
  const values = HospitalPatientModel.schema.path('coordinationStatus')?.options.enum;
  assert.ok(Array.isArray(values));
  assert.ok(values.includes('REASSIGNMENT_REQUIRED'));
});
