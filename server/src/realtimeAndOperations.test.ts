import test from 'node:test';
import assert from 'node:assert/strict';
import { facilitySearchQuerySchema } from './schemas/facility.js';
import { allowedTripTransitions } from './services/ambulanceOperationsService.js';
import {
  registerRealtimeClient,
  unregisterRealtimeClient,
  getConnectedClientsCount,
  broadcastEvent,
} from './services/realtimeService.js';
import type { Response } from 'express';

test('facilitySearchQuerySchema accepts all recognized clinical categories', () => {
  const recognizedCategories = [
    'emergency',
    'trauma',
    'urgent_care',
    'pediatric',
    'cardiology',
    'neurology',
    'orthopaedics',
    'maternity',
    'multispeciality',
    'general',
  ] as const;

  for (const cat of recognizedCategories) {
    const res = facilitySearchQuerySchema.safeParse({ category: cat });
    assert.equal(res.success, true, `Category ${cat} should be valid in schema`);
  }

  // Rejects invalid category
  const invalid = facilitySearchQuerySchema.safeParse({ category: 'dermatology_nonexistent' });
  assert.equal(invalid.success, false);
});

test('trip state machine transitions support direct arrival and terminal closures', () => {
  // ACCEPTED permits direct AT_PICKUP without requiring intermediate TO_PICKUP
  assert.ok(allowedTripTransitions.ACCEPTED?.includes('AT_PICKUP'));
  assert.ok(allowedTripTransitions.ACCEPTED?.includes('TO_PICKUP'));
  assert.ok(allowedTripTransitions.ACCEPTED?.includes('CANCELLED'));

  // PATIENT_ONBOARD permits direct AT_HOSPITAL without requiring intermediate TO_HOSPITAL
  assert.ok(allowedTripTransitions.PATIENT_ONBOARD?.includes('AT_HOSPITAL'));
  assert.ok(allowedTripTransitions.PATIENT_ONBOARD?.includes('TO_HOSPITAL'));

  // Terminal states have zero outward transitions
  assert.deepEqual(allowedTripTransitions.COMPLETED, []);
  assert.deepEqual(allowedTripTransitions.CANCELLED, []);

  // Prohibited jumps
  assert.ok(!allowedTripTransitions.ASSIGNED?.includes('COMPLETED'));
  assert.ok(!allowedTripTransitions.AT_PICKUP?.includes('COMPLETED'));
});

test('realtime push service registers, broadcasts SSE events, and unregisters clients cleanly', () => {
  const initialCount = getConnectedClientsCount();
  const capturedMessages: string[] = [];

  const mockRes = {
    write: (msg: string) => {
      capturedMessages.push(msg);
      return true;
    },
  } as unknown as Response;

  const clientId = 'test-client-123';
  const hospitalChannel = 'hospital:507f1f77bcf86cd799439011';

  registerRealtimeClient(clientId, hospitalChannel, mockRes);
  assert.equal(getConnectedClientsCount(), initialCount + 1);

  // Broadcast to matching channel
  broadcastEvent(hospitalChannel, 'hospital:incoming-patient', { patientName: 'Test Patient', eta: 5 });
  assert.equal(capturedMessages.length, 1);
  const firstMessage = capturedMessages[0] ?? '';
  assert.ok(firstMessage.startsWith('event: hospital:incoming-patient\n'));
  assert.ok(firstMessage.includes('"channel":"hospital:507f1f77bcf86cd799439011"'));
  assert.ok(firstMessage.includes('"eta":5'));

  // Broadcast to non-matching channel
  broadcastEvent('driver:some-other-id', 'tracking:location:update', { lat: 26.9, lng: 75.8 });
  assert.equal(capturedMessages.length, 1); // Should not increase

  // Unregister client
  unregisterRealtimeClient(clientId);
  assert.equal(getConnectedClientsCount(), initialCount);

  // Broadcast again after unregister
  broadcastEvent(hospitalChannel, 'hospital:incoming-patient', { patientName: 'Should Not Arrive' });
  assert.equal(capturedMessages.length, 1); // Still 1
});

test('realtime push service handles closed or failing client streams gracefully', () => {
  const failingRes = {
    write: () => {
      throw new Error('EPIPE: Broken pipe / connection terminated');
    },
  } as unknown as Response;

  const deadClientId = 'dead-client-999';
  registerRealtimeClient(deadClientId, 'operations', failingRes);

  // Broadcasting should catch the exception and prune the dead client
  assert.doesNotThrow(() => {
    broadcastEvent('operations', 'tracking:status', { status: 'AT_PICKUP' });
  });

  // Client should be pruned on failure
  const countAfterPrune = getConnectedClientsCount();
  unregisterRealtimeClient(deadClientId); // Safe even if already pruned
  assert.equal(getConnectedClientsCount(), countAfterPrune);
});
