import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/User.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { DispatchJobModel } from '../models/DispatchJob.js';
import { TripModel } from '../models/Trip.js';
import { createEmergencyRequest } from '../services/emergencyService.js';
import { startDriverDuty, endDriverDuty, updateDriverLocation } from '../services/driverDutyService.js';
import { listDriverDispatchOffers, acceptDispatchOffer } from '../services/dispatchService.js';
import { getEmergencyTrackingSnapshot } from '../services/trackingService.js';
import { arrivedPickup, patientPickedUp, arrivedHospital, completeTrip } from '../services/ambulanceOperationsService.js';
import type { AuthenticatedIdentity } from '../types/auth.js';

export const runE2EVerification = async () => {
  await connectDatabase();
  console.log('🚀 Running ResQ 2.0 End-to-End Emergency Workflow Acceptance Verification...\n');

  // Step 1: Load and verify demo accounts
  console.log('--- Step 1: Verifying Demo Accounts in Database ---');
  const user = await UserModel.findOne({ email: 'demo.user@resq.local' }).lean().exec();
  const hospital = await HospitalModel.findOne({ email: 'demo.hospital@resq.local' }).lean().exec();
  const provider = await AmbulanceProviderModel.findOne({ email: 'demo.provider@resq.local' }).lean().exec();
  const ambulance = await AmbulanceModel.findOne({ vehicleNumber: 'RJ-14-EA-1001' }).lean().exec();
  const driver = await AmbulanceDriverModel.findOne({ email: 'demo.driver@resq.local' }).lean().exec();

  assert.ok(user, 'demo.user@resq.local must exist');
  assert.ok(hospital, 'demo.hospital@resq.local must exist');
  assert.ok(provider, 'demo.provider@resq.local must exist');
  assert.ok(ambulance, 'Ambulance RJ-14-EA-1001 must exist');
  assert.ok(driver, 'demo.driver@resq.local must exist');

  assert.equal(hospital.verificationStatus, 'VERIFIED');
  assert.equal(hospital.accountStatus, 'ACTIVE');
  assert.equal(provider.verificationStatus, 'VERIFIED');
  assert.equal(provider.accountStatus, 'ACTIVE');
  assert.equal(ambulance.verificationStatus, 'VERIFIED');
  assert.equal(ambulance.accountStatus, 'ACTIVE');
  assert.equal(driver.licenseVerificationStatus, 'VERIFIED');
  assert.equal(driver.accountStatus, 'ACTIVE');
  console.log('✅ All 5 demo accounts verified active and eligible in Atlas DB.\n');

  // Reset driver & ambulance to clean state if leftover from previous test
  await AmbulanceModel.updateOne({ _id: ambulance._id }, {
    $set: { currentStatus: 'OFFLINE' },
    $unset: { dispatchReservationId: 1, dispatchReservationExpiresAt: 1 },
  }).exec();
  await AmbulanceDriverModel.updateOne({ _id: driver._id }, {
    $set: { availabilityStatus: 'OFFLINE' },
    $unset: { dispatchReservationId: 1, dispatchReservationExpiresAt: 1 },
  }).exec();

  let emergencyId: string | null = null;
  let tripId: string | null = null;

  try {
    // Step 2: Driver goes ON DUTY with fresh GPS fix
    console.log('--- Step 2: Ambulance Driver Starts Duty ---');
    const now = new Date();
    const dutyResult = await startDriverDuty(String(driver._id), {
      latitude: 26.8950,
      longitude: 75.8020,
      accuracy: 8,
      timestamp: now,
    });
    assert.equal(dutyResult.status, 'ONLINE');
    assert.equal(dutyResult.dutyState, 'AVAILABLE');
    console.log(`✅ Driver ${driver.fullName} is now ON DUTY (ONLINE) with GPS coordinates [26.8950, 75.8020].\n`);

    // Step 3: Citizen initiates SOS Emergency
    console.log('--- Step 3: Citizen Triggers SOS Emergency Request ---');
    const idempotencyKey = `e2e-test-${Date.now()}`;
    const emergencyResult = await createEmergencyRequest(
      String(user._id),
      {
        hospitalId: String(hospital._id),
        situationType: 'Chest Pain',
        category: 'chest_pain',
        location: 'Malviya Nagar, Sector 4, Jaipur',
        latitude: 26.8529,
        longitude: 75.8055,
      },
      idempotencyKey,
    );
    emergencyId = emergencyResult.id;
    assert.ok(emergencyId, 'Emergency ID must be returned');
    assert.equal(emergencyResult.status, 'AMBULANCE_COORDINATION');
    assert.ok(emergencyResult.requestCode.startsWith('RSQ-'), 'Valid request code generated');
    console.log(`✅ Emergency created: ${emergencyResult.requestCode} (ID: ${emergencyId}) - Status: ${emergencyResult.status}`);

    // Verify linked hospital patient record
    const patientRecord = await HospitalPatientModel.findOne({ emergencyId }).lean().exec();
    assert.ok(patientRecord, 'Linked HospitalPatient record must exist');
    assert.equal(String(patientRecord.hospitalId), String(hospital._id));
    console.log(`✅ Hospital patient intake record persisted for Hospital: ${hospital.name}\n`);

    // Step 4: Dispatch Engine processes candidates and offers to driver
    console.log('--- Step 4: Dispatch Engine Execution ---');
    // Poll for dispatch offer (allowing background worker route calculation & transaction commit)
    let offers: Awaited<ReturnType<typeof listDriverDispatchOffers>> = [];
    for (let i = 0; i < 20; i++) {
      offers = await listDriverDispatchOffers(String(driver._id));
      if (offers.length > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    assert.ok(offers.length > 0, 'Driver must receive the dispatch offer');
    const matchedOffer = offers.find((o) => o.request?.id === emergencyId);
    assert.ok(matchedOffer, 'Driver offer must match the created emergency');
    const dispatchJobId = matchedOffer.dispatchJobId;
    console.log(`✅ Dispatch offer received by driver ${driver.fullName} (Job ID: ${dispatchJobId}, Route ETA: ${matchedOffer.route?.etaSeconds}s, Distance: ${matchedOffer.route?.distanceMeters}m)\n`);

    // Step 5: Driver accepts dispatch offer
    console.log('--- Step 5: Driver Accepts Dispatch Offer ---');
    const acceptResult = await acceptDispatchOffer(String(driver._id), dispatchJobId);
    tripId = acceptResult.tripId;
    assert.ok(tripId, 'Trip ID must be returned');
    assert.equal(acceptResult.status, 'ACCEPTED');
    console.log(`✅ Dispatch offer accepted. Trip created: ${tripId} with status ACCEPTED.\n`);

    // Step 6: Live Location and Tracking Snapshot Verification
    console.log('--- Step 6: Live Location Telemetry & Tracking Snapshot ---');
    const gpsFixTime = new Date();
    await updateDriverLocation(String(driver._id), {
      latitude: 26.8940,
      longitude: 75.8025,
      accuracy: 6,
      timestamp: gpsFixTime,
    });

    const userAuth: AuthenticatedIdentity = {
      id: String(user._id),
      email: user.email,
      role: 'USER',
      accountStatus: 'ACTIVE',
    };
    const trackingSnapshot = await getEmergencyTrackingSnapshot(userAuth, emergencyId);
    assert.equal(trackingSnapshot.trackingActive, true);
    assert.equal(trackingSnapshot.routeTarget, 'PICKUP');
    assert.equal(trackingSnapshot.ambulance?.vehicleNumber, 'RJ-14-EA-1001');
    assert.equal(trackingSnapshot.location?.freshness, 'FRESH');
    assert.equal(trackingSnapshot.location?.coordinatesAreLive, true);
    console.log(`✅ Tracking snapshot verified: live GPS fresh, vehicle ${trackingSnapshot.ambulance?.vehicleNumber}, target: ${trackingSnapshot.routeTarget}\n`);

    // Step 7: Trip Lifecycle State Transitions
    console.log('--- Step 7: Complete Trip Lifecycle Transitions ---');

    // 7a: Arrive at pickup
    const pickupResult = await arrivedPickup(String(driver._id), tripId);
    assert.equal(pickupResult.status, 'AT_PICKUP');
    console.log('  -> Status transition: AT_PICKUP');

    // 7b: Patient onboard (transitions through PATIENT_ONBOARD to TO_HOSPITAL)
    const onboardResult = await patientPickedUp(String(driver._id), tripId);
    assert.equal(onboardResult.status, 'TO_HOSPITAL');
    assert.ok(onboardResult.patientPickedUpAt, 'patientPickedUpAt timestamp must be recorded');
    const onboardTripInDb = await TripModel.findById(tripId).lean().exec();
    assert.ok(onboardTripInDb?.statusHistory?.some((s) => s.status === 'PATIENT_ONBOARD'), 'statusHistory must include PATIENT_ONBOARD');
    console.log('  -> Status transition: PATIENT_ONBOARD -> TO_HOSPITAL');

    // Verify route target switches to HOSPITAL when patient is onboard
    const onboardSnapshot = await getEmergencyTrackingSnapshot(userAuth, emergencyId);
    assert.equal(onboardSnapshot.routeTarget, 'HOSPITAL');
    console.log('  -> Route target dynamically switched to HOSPITAL');

    // 7c: Arrive at hospital
    const hospitalArrivalResult = await arrivedHospital(String(driver._id), tripId);
    assert.equal(hospitalArrivalResult.status, 'AT_HOSPITAL');
    console.log('  -> Status transition: AT_HOSPITAL');

    // 7d: Complete trip / handover
    const completedResult = await completeTrip(String(driver._id), tripId);
    assert.equal(completedResult.status, 'COMPLETED');
    console.log('  -> Status transition: COMPLETED\n');

    // Step 8: Verify Emergency and Hospital Resolution
    console.log('--- Step 8: Verifying System Resolution State ---');
    const resolvedEmergency = await EmergencyRequestModel.findById(emergencyId).lean().exec();
    assert.equal(resolvedEmergency?.status, 'RESOLVED');
    console.log(`✅ Emergency ${resolvedEmergency?.requestCode} status is RESOLVED.`);

    const resolvedPatient = await HospitalPatientModel.findOne({ emergencyId }).lean().exec();
    assert.equal(resolvedPatient?.coordinationStatus, 'RESOLVED');
    console.log('✅ Hospital intake coordination status is RESOLVED.');

    const availableAmbulance = await AmbulanceModel.findById(ambulance._id).lean().exec();
    assert.equal(availableAmbulance?.currentStatus, 'AVAILABLE');
    console.log('✅ Ambulance RJ-14-EA-1001 returned to AVAILABLE.');

    // Step 9: Driver Ends Duty
    console.log('\n--- Step 9: Driver Ends Duty ---');
    const endDutyResult = await endDriverDuty(String(driver._id));
    assert.equal(endDutyResult.status, 'OFFLINE');
    console.log('✅ Driver ended duty and is safely OFFLINE.');

    console.log('\n======================================================');
    console.log('🎉 FULL END-TO-END EMERGENCY WORKFLOW TEST PASSED! 🎉');
    console.log('All 6 acceptance criteria verified with real DB state.');
    console.log('======================================================\n');
  } finally {
    // Cleanup the transient test emergency, job, and trip records
    if (emergencyId) {
      await EmergencyRequestModel.deleteOne({ _id: emergencyId }).exec();
      await HospitalPatientModel.deleteMany({ emergencyId }).exec();
      await DispatchJobModel.deleteMany({ emergencyRequestId: emergencyId }).exec();
    }
    if (tripId) {
      await TripModel.deleteOne({ _id: tripId }).exec();
    }
    // Ensure demo ambulance & driver are restored to clean initial status
    await AmbulanceModel.updateOne({ _id: ambulance._id }, {
      $set: { currentStatus: 'OFFLINE' },
      $unset: { dispatchReservationId: 1, dispatchReservationExpiresAt: 1 },
    }).exec();
    await AmbulanceDriverModel.updateOne({ _id: driver._id }, {
      $set: { availabilityStatus: 'OFFLINE' },
      $unset: { dispatchReservationId: 1, dispatchReservationExpiresAt: 1 },
    }).exec();
    console.log('🧹 Test records safely cleaned up from database.');
  }
};

runE2EVerification()
  .catch((err) => {
    console.error('❌ E2E Acceptance Verification Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
