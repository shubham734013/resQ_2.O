import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceModel } from '../models/Ambulance.js';

const migrate = async () => {
  await connectDatabase();

  const hospitals = await HospitalModel.find({
    location: { $exists: false },
    latitude: { $type: 'number' },
    longitude: { $type: 'number' },
  }).exec();
  for (const hospital of hospitals) {
    hospital.location = { type: 'Point', coordinates: [hospital.longitude as number, hospital.latitude as number] };
    await hospital.save();
  }

  const ambulances = await AmbulanceModel.find({
    location: { $exists: false },
    currentLatitude: { $type: 'number' },
    currentLongitude: { $type: 'number' },
  }).exec();
  for (const ambulance of ambulances) {
    ambulance.location = { type: 'Point', coordinates: [ambulance.currentLongitude as number, ambulance.currentLatitude as number] };
    ambulance.locationUpdatedAt = ambulance.updatedAt;
    await ambulance.save();
  }

  console.log('Migrated hospital locations:', hospitals.length);
  console.log('Migrated ambulance locations:', ambulances.length);
  await disconnectDatabase();
};

migrate().catch(async (error: unknown) => {
  console.error(error);
  await disconnectDatabase();
  process.exitCode = 1;
});