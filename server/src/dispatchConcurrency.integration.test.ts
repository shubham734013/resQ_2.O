import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { AmbulanceProviderModel } from './models/AmbulanceProvider.js';
import { AmbulanceModel } from './models/Ambulance.js';
import { AmbulanceDriverModel } from './models/AmbulanceDriver.js';
import { HospitalModel } from './models/Hospital.js';
import { EmergencyRequestModel } from './models/EmergencyRequest.js';
import { DispatchJobModel } from './models/DispatchJob.js';
import { TripModel } from './models/Trip.js';
process.env.NODE_ENV ??= 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/resq_test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-that-is-long-enough';
process.env.RESQ_ADMIN_EMAIL ??= 'admin@example.test';
process.env.RESQ_ADMIN_PASSWORD ??= 'test-only-password-long';

const { acceptDispatchOffer, rejectDispatchOffer, processDispatchTick, retryDispatchJob, reserveAndOffer } = await import('./services/dispatchService.js');
const { cancelUserEmergencyRequest } = await import('./services/emergencyService.js');
type DispatchCandidate = import('./services/dispatchService.js').DispatchCandidate;

const uri = process.env.DISPATCH_TEST_MONGODB_URI;
const enabled = Boolean(uri && /test|dispatch/i.test(new URL(uri).pathname));

test('concurrent reservations and duplicate acceptances create one active trip', { skip: !enabled }, async () => {
  if (!uri) return;
  const databaseName = new URL(uri).pathname.replace(/^\//, '').split('?')[0] ?? '';
  if (!/test|dispatch/i.test(databaseName)) throw new Error('DISPATCH_TEST_MONGODB_URI must target a dedicated database with "test" or "dispatch" in its name.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  const providerId = new Types.ObjectId();
  const ambulanceId = new Types.ObjectId();
  const driverId = new Types.ObjectId();
  const hospitalId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const requestIds = [new Types.ObjectId(), new Types.ObjectId()];
  const jobIds = [new Types.ObjectId(), new Types.ObjectId()];
  const suffix = new Types.ObjectId().toHexString();
  try {
    await AmbulanceProviderModel.create({
      _id: providerId, name: 'Dispatch Test Provider', registrationNumber: 'DTP-' + suffix,
      email: 'dispatch-' + suffix + '@example.test', phone: '0000000000', authProvider: 'LOCAL',
      profileCompletionStatus: 'COMPLETE', serviceType: 'Emergency', verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await HospitalModel.create({
      _id: hospitalId, name: 'Dispatch Test Hospital', registrationNumber: 'DTH-' + suffix,
      email: 'hospital-' + suffix + '@example.test', phone: '0000000000', passwordHash: 'test-only',
      hospitalType: 'General Hospital', services: ['Emergency Department'], capabilities: ['Emergency'],
      location: { type: 'Point', coordinates: [75.7873, 26.9124] }, latitude: 26.9124, longitude: 75.7873,
      emergencyAvailability: 'AVAILABLE', verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await AmbulanceModel.create({
      _id: ambulanceId, registrationNumber: 'DTA-' + suffix, vehicleNumber: 'DTV-' + suffix,
      providerId, ambulanceType: 'ALS', capabilities: ['Emergency'], currentStatus: 'AVAILABLE',
      currentLatitude: 26.9130, currentLongitude: 75.7880, location: { type: 'Point', coordinates: [75.7880, 26.9130] },
      locationUpdatedAt: new Date(), verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await AmbulanceDriverModel.create({
      _id: driverId, fullName: 'Dispatch Test Driver', email: 'driver-' + suffix + '@example.test',
      phone: '0000000000', passwordHash: 'test-only', licenseNumber: 'LIC-' + suffix,
      providerId, assignedAmbulanceId: ambulanceId, availabilityStatus: 'ONLINE',
      licenseVerificationStatus: 'VERIFIED', accountStatus: 'ACTIVE',
    });
    await EmergencyRequestModel.insertMany(requestIds.map((requestId, index) => ({
      _id: requestId, requestCode: 'RSQ-' + suffix.slice(0, 6) + index, userId, hospitalId,
      situationType: 'Other Acute Situation', category: 'other', reportedAt: new Date(),
      latitude: 26.9124, longitude: 75.7873, status: 'AMBULANCE_COORDINATION',
      statusHistory: [{ status: 'AMBULANCE_COORDINATION', changedAt: new Date(), actorRole: 'SYSTEM', previousStatus: 'RECEIVED' }],
    })));
    await DispatchJobModel.insertMany(jobIds.map((jobId, index) => ({
      _id: jobId, emergencyRequestId: requestIds[index]!, hospitalId, userId, category: 'other',
      pickupLatitude: 26.9124, pickupLongitude: 75.7873, status: 'SEARCHING', generation: 1,
      attempts: [], events: [], leaseToken: 'test-lease-' + index, leaseUntil: new Date(Date.now() + 30000),
    })));

    const candidate: DispatchCandidate = {
      providerId, ambulanceId, driverId,
      coordinates: { latitude: 26.9130, longitude: 75.7880 },
      straightLineMeters: 100,
      route: { source: 'DRIVING', distanceMeters: 300, etaSeconds: 90 },
    };
    const jobs: Array<Parameters<typeof reserveAndOffer>[0]> = await Promise.all(jobIds.map(async (jobId) => {
      const job = await DispatchJobModel.findById(jobId).lean().exec();
      assert.ok(job);
      return job as unknown as Parameters<typeof reserveAndOffer>[0];
    }));
    const reservations = await Promise.allSettled(jobs.map((job: Parameters<typeof reserveAndOffer>[0]) => reserveAndOffer(job, candidate)));
    assert.equal(reservations.filter((result) => result.status === 'fulfilled').length, 1, 'only one dispatch job may reserve a shared ambulance/driver');
    const offered = await DispatchJobModel.findOne({ _id: { $in: jobIds }, status: 'OFFERED' }).lean().exec();
    assert.ok(offered);
    assert.equal(String(offered.currentAmbulanceId), String(ambulanceId));
    assert.equal(String(offered.currentDriverId), String(driverId));

    const rejected = await rejectDispatchOffer(String(driverId), String(offered._id));
    assert.equal(rejected.status, 'REJECTED');
    const afterReject = await DispatchJobModel.findById(offered._id).lean().exec();
    assert.equal(afterReject?.status, 'PENDING');
    assert.equal((await AmbulanceModel.findById(ambulanceId).lean().exec())?.dispatchReservationId, undefined);
    assert.equal((await AmbulanceDriverModel.findById(driverId).lean().exec())?.dispatchReservationId, undefined);

    const otherJobId = jobIds.find((jobId) => String(jobId) !== String(offered._id))!;
    await DispatchJobModel.updateOne({ _id: otherJobId, status: 'SEARCHING' }, {
      $set: { status: 'PENDING', nextAttemptAt: new Date() }, $unset: { leaseToken: 1, leaseUntil: 1 },
    }).exec();
    await processDispatchTick();
    const timedOutOffer = await DispatchJobModel.findOne({ _id: { $in: jobIds }, status: 'OFFERED' }).lean().exec();
    assert.ok(timedOutOffer, 'the next eligible dispatch job should receive the released resources');
    await DispatchJobModel.updateOne({ _id: timedOutOffer._id, status: 'OFFERED' }, { $set: { deadlineAt: new Date(Date.now() - 1000) } }).exec();
    await processDispatchTick();
    const timedOutJob = await DispatchJobModel.findById(timedOutOffer._id).lean().exec();
    assert.ok(['EXHAUSTED', 'PENDING'].includes(timedOutJob?.status ?? ''), 'expired offer must be persisted and released before retry');
    await assert.rejects(() => acceptDispatchOffer(String(driverId), String(timedOutOffer._id)), 'expired offer must not be accepted later');
    assert.equal((await AmbulanceModel.findById(ambulanceId).lean().exec())?.dispatchReservationId, undefined);
    assert.equal((await AmbulanceDriverModel.findById(driverId).lean().exec())?.dispatchReservationId, undefined);

    const retried = await retryDispatchJob(String(userId), String(timedOutOffer._id));
    assert.equal(retried.status, 'PENDING');
    const leaseToken = 'integration-lease-' + suffix;
    await DispatchJobModel.updateOne({ _id: timedOutOffer._id, status: 'PENDING' }, {
      $set: { status: 'SEARCHING', leaseToken, leaseUntil: new Date(Date.now() + 30000) },
    }).exec();
    const retryJob = await DispatchJobModel.findById(timedOutOffer._id).lean().exec();
    assert.ok(retryJob);
    const retryOffer = await reserveAndOffer(retryJob as unknown as Parameters<typeof reserveAndOffer>[0], candidate);
    assert.ok(retryOffer);
    const acceptances = await Promise.allSettled([
      acceptDispatchOffer(String(driverId), String(timedOutOffer._id)),
      acceptDispatchOffer(String(driverId), String(timedOutOffer._id)),
    ]);
    assert.ok(acceptances.some((result) => result.status === 'fulfilled'), 'one acceptance should succeed or be safely idempotent');
    assert.equal(await TripModel.countDocuments({ emergencyRequestId: timedOutOffer.emergencyRequestId }), 1, 'exactly one trip must be persisted');
    const [savedJob, savedAmbulance, savedDriver] = await Promise.all([
      DispatchJobModel.findById(timedOutOffer._id).lean().exec(),
      AmbulanceModel.findById(ambulanceId).lean().exec(),
      AmbulanceDriverModel.findById(driverId).lean().exec(),
    ]);
    assert.equal(savedJob?.status, 'ACCEPTED');
    assert.equal(savedAmbulance?.currentStatus, 'BUSY');
    assert.equal(savedDriver?.availabilityStatus, 'BUSY');
    assert.equal(savedAmbulance?.dispatchReservationId, undefined);
    assert.equal(savedDriver?.dispatchReservationId, undefined);
    await assert.rejects(
      () => cancelUserEmergencyRequest(String(new Types.ObjectId()), String(timedOutOffer.emergencyRequestId)),
      'a different user must not cancel this emergency',
    );
    const cancelled = await cancelUserEmergencyRequest(String(userId), String(timedOutOffer.emergencyRequestId));
    assert.equal(cancelled.status, 'CANCELLED');
    const [cancelledJob, cancelledTrip, releasedAmbulance, releasedDriver] = await Promise.all([
      DispatchJobModel.findById(timedOutOffer._id).lean().exec(),
      TripModel.findOne({ emergencyRequestId: timedOutOffer.emergencyRequestId }).lean().exec(),
      AmbulanceModel.findById(ambulanceId).lean().exec(),
      AmbulanceDriverModel.findById(driverId).lean().exec(),
    ]);
    assert.equal(cancelledJob?.status, 'CANCELLED');
    assert.equal(cancelledJob?.attempts.find((attempt) => attempt.attemptId === cancelledJob.currentAttemptId)?.status, 'ACCEPTED', 'cancellation must preserve the accepted attempt outcome');
    assert.equal(cancelledTrip?.status, 'CANCELLED');
    assert.equal(releasedAmbulance?.currentStatus, 'AVAILABLE');
    assert.equal(releasedDriver?.availabilityStatus, 'ONLINE');
  } finally {
    await TripModel.deleteMany({ emergencyRequestId: { $in: requestIds } });
    await DispatchJobModel.deleteMany({ _id: { $in: jobIds } });
    await EmergencyRequestModel.deleteMany({ _id: { $in: requestIds } });
    await AmbulanceDriverModel.deleteMany({ _id: driverId });
    await AmbulanceModel.deleteMany({ _id: ambulanceId });
    await AmbulanceProviderModel.deleteMany({ _id: providerId });
    await HospitalModel.deleteMany({ _id: hospitalId });
    await mongoose.disconnect();
  }
});
