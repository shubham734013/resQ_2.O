import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { AmbulanceProviderModel } from './models/AmbulanceProvider.js';
import { AmbulanceModel } from './models/Ambulance.js';
import { AmbulanceDriverModel } from './models/AmbulanceDriver.js';
import { TripModel } from './models/Trip.js';

process.env.NODE_ENV ??= 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/resq_test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-that-is-long-enough';
process.env.RESQ_ADMIN_EMAIL ??= 'admin@example.test';
process.env.RESQ_ADMIN_PASSWORD ??= 'test-only-password-long';
process.env.DRIVER_LOCATION_UPDATE_INTERVAL_MS ??= '4000';
process.env.DRIVER_LOCATION_STALE_AFTER_MS ??= '15000';
process.env.DRIVER_LOCATION_MAX_AGE_MS ??= '30000';

const uri = process.env.DRIVER_DUTY_TEST_MONGODB_URI;
const enabled = Boolean(uri && /test|driver.?duty/i.test(new URL(uri).pathname));
const { startDriverDuty, endDriverDuty, updateDriverLocation } = await import('./services/driverDutyService.js');

test('concurrent duty starts serialize; GPS timestamps are monotonic; active trips block ending duty', { skip: !enabled }, async () => {
  if (!uri) return;
  const databaseName = new URL(uri).pathname.replace(/^\//, '').split('?')[0] ?? '';
  if (!/test|driver.?duty/i.test(databaseName)) throw new Error('DRIVER_DUTY_TEST_MONGODB_URI must target a dedicated database whose name contains "test" or "driver-duty".');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const providerId = new Types.ObjectId();
  const ambulanceId = new Types.ObjectId();
  const driverId = new Types.ObjectId();
  const mismatchedDriverId = new Types.ObjectId();
  const mismatchedProviderId = new Types.ObjectId();
  const emergencyId = new Types.ObjectId();
  const hospitalId = new Types.ObjectId();
  const suffix = new Types.ObjectId().toHexString();
  try {
    await AmbulanceProviderModel.create({
      _id: providerId, name: 'Duty Test Provider', registrationNumber: 'DTP-' + suffix,
      email: 'duty-provider-' + suffix + '@example.test', phone: '0000000000', authProvider: 'LOCAL',
      profileCompletionStatus: 'COMPLETE', serviceType: 'Emergency', verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await AmbulanceModel.create({
      _id: ambulanceId, registrationNumber: 'DTA-' + suffix, vehicleNumber: 'DTV-' + suffix,
      providerId, ambulanceType: 'ALS', capabilities: ['Emergency'], currentStatus: 'OFFLINE',
      verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await AmbulanceDriverModel.create({
      _id: driverId, fullName: 'Duty Test Driver', email: 'duty-driver-' + suffix + '@example.test',
      phone: '0000000000', passwordHash: 'test-only', licenseNumber: 'LIC-' + suffix,
      providerId, assignedAmbulanceId: ambulanceId, availabilityStatus: 'OFFLINE',
      licenseVerificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await AmbulanceDriverModel.create({
      _id: mismatchedDriverId, fullName: 'Wrong Owner Driver', email: 'duty-mismatch-' + suffix + '@example.test',
      phone: '0000000000', passwordHash: 'test-only', licenseNumber: 'LIC-MISMATCH-' + suffix,
      providerId: mismatchedProviderId, assignedAmbulanceId: ambulanceId, availabilityStatus: 'OFFLINE',
      licenseVerificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    const now = Date.now();
    const fix = (timestamp: number) => ({ latitude: 26.9124, longitude: 75.7873, accuracy: 8, timestamp: new Date(timestamp) });
    await assert.rejects(() => startDriverDuty(String(mismatchedDriverId), fix(now)), /Assigned ambulance must be active, verified/i);
    const starts = await Promise.allSettled([
      startDriverDuty(String(driverId), fix(now)),
      startDriverDuty(String(driverId), fix(now + 1)),
    ]);
    assert.equal(starts.filter(result => result.status === 'fulfilled').length, 1, 'only one concurrent start may transition OFFLINE to ONLINE');
    assert.equal((await AmbulanceDriverModel.findById(driverId).lean().exec())?.availabilityStatus, 'ONLINE');
    assert.equal((await AmbulanceModel.findById(ambulanceId).lean().exec())?.currentStatus, 'AVAILABLE');
    const saved = await AmbulanceModel.findById(ambulanceId).lean().exec();
    assert.ok(saved?.locationSourceTimestamp);
    await assert.rejects(
      () => updateDriverLocation(String(driverId), fix(saved!.locationSourceTimestamp!.getTime())),
      /Duplicate or out-of-order GPS updates/i,
    );
    const ended = await endDriverDuty(String(driverId));
    assert.equal(ended.dutyState, 'OFF_DUTY');
    assert.equal((await AmbulanceDriverModel.findById(driverId).lean().exec())?.availabilityStatus, 'OFFLINE');
    assert.equal((await AmbulanceModel.findById(ambulanceId).lean().exec())?.currentStatus, 'OFFLINE');

    const restarted = await startDriverDuty(String(driverId), fix(Date.now() + 2));
    assert.equal(restarted.dutyState, 'AVAILABLE');
    await TripModel.create({
      emergencyRequestId: emergencyId, providerId, ambulanceId, driverId, destinationHospitalId: hospitalId,
      status: 'TO_PICKUP', statusHistory: [{ status: 'TO_PICKUP', changedAt: new Date(), actorRole: 'SYSTEM' }],
    });
    await AmbulanceDriverModel.updateOne({ _id: driverId }, { $set: { availabilityStatus: 'BUSY' } });
    await AmbulanceModel.updateOne({ _id: ambulanceId }, { $set: { currentStatus: 'BUSY' } });
    await assert.rejects(() => endDriverDuty(String(driverId)), /active trip/i);
    assert.equal((await AmbulanceDriverModel.findById(driverId).lean().exec())?.availabilityStatus, 'BUSY');
    assert.equal((await AmbulanceModel.findById(ambulanceId).lean().exec())?.currentStatus, 'BUSY');
  } finally {
    await TripModel.deleteMany({ driverId });
    await AmbulanceDriverModel.deleteMany({ _id: { $in: [driverId, mismatchedDriverId] } });
    await AmbulanceModel.deleteMany({ _id: ambulanceId });
    await AmbulanceProviderModel.deleteMany({ _id: providerId });
    await mongoose.disconnect();
  }
});
