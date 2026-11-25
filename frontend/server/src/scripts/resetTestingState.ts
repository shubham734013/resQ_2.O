import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { DispatchJobModel } from '../models/DispatchJob.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceModel } from '../models/Ambulance.js';

async function resetTestingState() {
  await connectDatabase();
  console.log('🔄 Resetting ResQ 2.0 system state for fresh end-to-end testing...');

  // 1. Delete all in-progress / unfinalized emergencies
  const deletedEmergencies = await EmergencyRequestModel.deleteMany({
    status: { $in: ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'] },
  });
  console.log(`  ✓ Cleared active emergency requests: ${deletedEmergencies.deletedCount}`);

  // 2. Delete all active trips
  const deletedTrips = await TripModel.deleteMany({
    status: { $in: ['ASSIGNED', 'ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'] },
  });
  console.log(`  ✓ Cleared active trips: ${deletedTrips.deletedCount}`);

  // 3. Delete active dispatch jobs
  const deletedJobs = await DispatchJobModel.deleteMany({
    status: { $in: ['PENDING', 'SEARCHING', 'OFFERED', 'ACCEPTED'] },
  });
  console.log(`  ✓ Cleared active dispatch jobs: ${deletedJobs.deletedCount}`);

  // 4. Clear active hospital patient intake cases
  const deletedPatients = await HospitalPatientModel.deleteMany({
    coordinationStatus: { $in: ['INCOMING', 'HOSPITAL_NOTIFIED', 'AT_HOSPITAL', 'REASSIGNMENT_REQUIRED'] },
  });
  console.log(`  ✓ Cleared active hospital patient records: ${deletedPatients.deletedCount}`);

  // 5. Restore verified drivers to ONLINE and on-duty with fresh location
  const updatedDrivers = await AmbulanceDriverModel.updateMany(
    { accountStatus: 'ACTIVE', licenseVerificationStatus: 'VERIFIED' },
    {
      $set: {
        availabilityStatus: 'ONLINE',
        isOnDuty: true,
        registeredLatitude: 26.8950,
        registeredLongitude: 75.8020,
      },
      $unset: {
        dispatchReservationId: 1,
        dispatchReservationExpiresAt: 1,
      },
    }
  );
  console.log(`  ✓ Restored verified drivers to ONLINE (on-duty): ${updatedDrivers.modifiedCount}`);

  // 6. Restore verified ambulances to AVAILABLE with fresh location
  const updatedAmbulances = await AmbulanceModel.updateMany(
    { accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' },
    {
      $set: {
        currentStatus: 'AVAILABLE',
        currentLatitude: 26.8950,
        currentLongitude: 75.8020,
        locationUpdatedAt: new Date(),
        location: { type: 'Point', coordinates: [75.8020, 26.8950] },
      },
      $unset: {
        dispatchReservationId: 1,
        dispatchReservationExpiresAt: 1,
      },
    }
  );
  console.log(`  ✓ Restored verified ambulances to AVAILABLE: ${updatedAmbulances.modifiedCount}`);

  console.log('\n======================================================');
  console.log('✅ FRESH TEST ENVIRONMENT READY!');
  console.log('You can now log in as Citizen (demo.user@resq.local),');
  console.log('Driver (demo.driver@resq.local), and Hospital (demo.hospital@resq.local)');
  console.log('to test the complete emergency request flow from scratch.');
  console.log('======================================================');

  await disconnectDatabase();
}

resetTestingState().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
