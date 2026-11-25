import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { DispatchJobModel } from '../models/DispatchJob.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceModel } from '../models/Ambulance.js';

async function diagnose() {
  await connectDatabase();
  console.log('--- LATEST EMERGENCIES ---');
  const emgs = await EmergencyRequestModel.find().sort({ createdAt: -1 }).limit(3).lean();
  for (const e of emgs) {
    console.log('Emergency:', e._id, e.requestCode, 'status:', e.status, 'category:', e.category, 'lat:', e.latitude, 'lon:', e.longitude, 'createdAt:', e.createdAt);
    const job = await DispatchJobModel.findOne({ emergencyRequestId: e._id }).lean();
    if (job) {
      console.log('  -> Job status:', job.status, 'attempts:', job.attempts?.length, 'currentDriverId:', job.currentDriverId, 'exhaustedAt:', job.exhaustedAt, 'escalationReason:', job.escalationReason);
      if (job.events) {
        console.log('  -> Job events:', job.events.map(ev => ({ event: ev.event, reason: ev.reason })));
      }
    } else {
      console.log('  -> NO DISPATCH JOB FOUND!');
    }
  }

  console.log('\n--- DRIVERS STATUS ---');
  const drivers = await AmbulanceDriverModel.find().select('fullName email availabilityStatus isOnDuty assignedAmbulanceId accountStatus licenseVerificationStatus registeredLatitude registeredLongitude').lean();
  for (const d of drivers) {
    console.log('Driver:', d.email, 'status:', d.availabilityStatus, 'onDuty:', d.isOnDuty, 'assignedAmb:', d.assignedAmbulanceId, 'accStatus:', d.accountStatus, 'licStatus:', d.licenseVerificationStatus);
  }

  console.log('\n--- AMBULANCES STATUS ---');
  const ambs = await AmbulanceModel.find().select('registrationNumber vehicleNumber currentStatus accountStatus verificationStatus locationUpdatedAt currentLatitude currentLongitude').lean();
  for (const a of ambs) {
    console.log('Amb:', a.vehicleNumber, a.registrationNumber, 'status:', a.currentStatus, 'accStatus:', a.accountStatus, 'verStatus:', a.verificationStatus, 'locUpdated:', a.locationUpdatedAt);
  }

  await disconnectDatabase();
}
diagnose().catch(console.error);
