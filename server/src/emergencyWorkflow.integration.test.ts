import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { UserModel } from './models/User.js';
import { HospitalModel } from './models/Hospital.js';
import { EmergencyRequestModel } from './models/EmergencyRequest.js';
import { HospitalPatientModel } from './models/HospitalPatient.js';

process.env.NODE_ENV ??= 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/resq_test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-that-is-long-enough';
process.env.RESQ_ADMIN_EMAIL ??= 'admin@example.test';
process.env.RESQ_ADMIN_PASSWORD ??= 'test-only-password-long';

const uri = process.env.SOS_TEST_MONGODB_URI;
const enabled = Boolean(uri && /test|sos/i.test(new URL(uri).pathname));
const { createEmergencyRequest, cancelUserEmergencyRequest } = await import('./services/emergencyService.js');

test('SOS persists a hospital case, safely replays idempotent requests, rejects key reuse, and cancels both records', { skip: !enabled }, async () => {
  if (!uri) return;
  const databaseName = new URL(uri).pathname.replace(/^\\//, '').split('?')[0] ?? '';
  assert.match(databaseName, /test|sos/i, 'SOS_TEST_MONGODB_URI must use a dedicated test database');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const suffix = new Types.ObjectId().toHexString();
  const userId = new Types.ObjectId();
  const hospitalId = new Types.ObjectId();
  const idempotencyKey = 'sos-integration-' + suffix;
  try {
    await Promise.all([
      UserModel.syncIndexes(),
      HospitalModel.syncIndexes(),
      EmergencyRequestModel.syncIndexes(),
      HospitalPatientModel.syncIndexes(),
    ]);
    await UserModel.create({
      _id: userId, name: 'SOS Integration User', email: 'sos-user-' + suffix + '@example.test',
      authProvider: 'LOCAL', role: 'USER', accountStatus: 'ACTIVE',
    });
    await HospitalModel.create({
      _id: hospitalId, name: 'SOS Integration Hospital', registrationNumber: 'SOSH-' + suffix,
      email: 'sos-hospital-' + suffix + '@example.test', phone: '0000000000', passwordHash: 'test-only',
      hospitalType: 'General Hospital', services: ['Emergency Department'], capabilities: ['Cardiology & Cath Lab'],
      location: { type: 'Point', coordinates: [75.7873, 26.9124] }, latitude: 26.9124, longitude: 75.7873,
      emergencyAvailability: 'AVAILABLE', verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });

    const input = {
      hospitalId: String(hospitalId), situationType: 'Chest Pain', category: 'chest_pain' as const,
      location: 'Confirmed test pickup', latitude: 26.9124, longitude: 75.7873,
    };
    const first = await createEmergencyRequest(String(userId), input, idempotencyKey);
    const retry = await createEmergencyRequest(String(userId), input, idempotencyKey);
    assert.equal(retry.id, first.id, 'a retry with the same key returns the original request');
    assert.equal(await EmergencyRequestModel.countDocuments({ userId, idempotencyKey }), 1, 'a retry must not create a duplicate emergency');
    const persisted = await EmergencyRequestModel.findOne({ userId, idempotencyKey }).lean().exec();
    assert.ok(persisted?.patientId, 'the emergency must link to a persisted hospital case');
    const patient = await HospitalPatientModel.findOne({ emergencyId: persisted?._id }).lean().exec();
    assert.ok(patient, 'the hospital case must be persisted with the emergency');
    assert.equal(patient?.coordinationStatus, 'INCOMING');

    await assert.rejects(
      () => createEmergencyRequest(String(userId), { ...input, latitude: 26.9130 }, idempotencyKey),
      /already used for a different SOS payload/i,
    );

    const cancelled = await cancelUserEmergencyRequest(String(userId), first.id);
    assert.equal(cancelled.status, 'CANCELLED');
    const [savedEmergency, savedPatient] = await Promise.all([
      EmergencyRequestModel.findById(first.id).lean().exec(),
      HospitalPatientModel.findOne({ emergencyId: first.id }).lean().exec(),
    ]);
    assert.equal(savedEmergency?.status, 'CANCELLED');
    assert.equal(savedEmergency?.statusHistory.at(-1)?.actorRole, 'USER');
    assert.equal(savedPatient?.coordinationStatus, 'CANCELLED');
    await assert.rejects(() => cancelUserEmergencyRequest(String(userId), first.id), /no longer eligible for user cancellation/i);
  } finally {
    await Promise.all([
      HospitalPatientModel.deleteMany({ hospitalId, emergencyId: { $exists: true } }),
      EmergencyRequestModel.deleteMany({ userId }),
      HospitalModel.deleteMany({ _id: hospitalId }),
      UserModel.deleteMany({ _id: userId }),
    ]);
    await mongoose.disconnect();
  }
});
