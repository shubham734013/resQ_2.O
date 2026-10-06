import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceModel } from '../models/Ambulance.js';

const migrate = async () => {
  await connectDatabase();

  const hospitals = await HospitalModel.collection.find({
    latitude: { $type: 'number' },
    longitude: { $type: 'number' },
    $or: [{ location: { $exists: false } }, { location: null }],
  }).toArray();

  for (const hospital of hospitals) {
    if (typeof hospital.latitude !== 'number' || typeof hospital.longitude !== 'number') continue;
    await HospitalModel.collection.updateOne(
      { _id: hospital._id },
      { $set: { location: { type: 'Point', coordinates: [hospital.longitude, hospital.latitude] } } },
    );
  }

  const ambulances = await AmbulanceModel.collection.find({
    currentLatitude: { $type: 'number' },
    currentLongitude: { $type: 'number' },
    $or: [{ location: { $exists: false } }, { location: null }],
  }).toArray();

  for (const ambulance of ambulances) {
    if (typeof ambulance.currentLatitude !== 'number' || typeof ambulance.currentLongitude !== 'number') continue;
    await AmbulanceModel.collection.updateOne(
      { _id: ambulance._id },
      {
        $set: {
          location: { type: 'Point', coordinates: [ambulance.currentLongitude, ambulance.currentLatitude] },
          locationUpdatedAt: ambulance.updatedAt ?? new Date(),
        },
      },
    );
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
