import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/User.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';

const BCRYPT_ROUNDS = 10;
const DEMO_PASSWORD = 'Password@123';

export const seedDemoData = async () => {
  await connectDatabase();
  console.log('🌱 Starting ResQ Demo Data Seeding...');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  // 1. Seed Demo Citizen / User
  const userEmail = 'demo.user@resq.local';
  const user = await UserModel.findOneAndUpdate(
    { email: userEmail },
    {
      $set: {
        name: 'Demo Citizen (Shubham)',
        email: userEmail,
        phone: '9876543210',
        passwordHash,
        authProvider: 'LOCAL',
        role: 'USER',
        address: 'Malviya Nagar, Sector 4',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        latitude: 26.8529,
        longitude: 75.8055,
        accountStatus: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Demo User ready: ${user.email} (ID: ${user._id})`);

  // 2. Seed Demo Verified Hospital
  const hospitalEmail = 'demo.hospital@resq.local';
  const hospital = await HospitalModel.findOneAndUpdate(
    { email: hospitalEmail },
    {
      $set: {
        name: 'SMS Multispeciality & Trauma Hospital (Demo)',
        registrationNumber: 'HOSP-DEMO-SMS-01',
        email: hospitalEmail,
        phone: '9876543213',
        passwordHash,
        address: 'Jawaharlal Nehru Marg, Ashok Nagar',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        latitude: 26.8917,
        longitude: 75.8155,
        location: {
          type: 'Point',
          coordinates: [75.8155, 26.8917],
        },
        hospitalType: 'Government Multispeciality & Trauma',
        services: ['Emergency', 'Trauma', 'Cardiology', 'Neurology', 'Pediatric', 'ICU', 'Burn Care', 'Orthopedics'],
        capabilities: ['24/7 Trauma Unit', 'Cath Lab', 'Emergency Surgery', 'Cardiac ICU', 'Pediatric ICU'],
        resourceSummary: new Map([
          ['icuBeds', 12],
          ['emergencyBeds', 24],
          ['ventilators', 8],
          ['operationTheatres', 6],
        ]),
        emergencyAvailability: 'AVAILABLE',
        publicContactInformation: '24/7 Emergency Line: +91-141-2560291',
        operationalDescription: 'Level 1 Trauma Center with 24/7 active emergency intake and resuscitation teams.',
        verificationStatus: 'VERIFIED',
        accountStatus: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Demo Hospital ready: ${hospital.name} (${hospital.email})`);

  // 3. Seed Demo Ambulance Provider
  const providerEmail = 'demo.provider@resq.local';
  const provider = await AmbulanceProviderModel.findOneAndUpdate(
    { email: providerEmail },
    {
      $set: {
        name: 'Apex LifeCare Ambulances (Demo)',
        registrationNumber: 'PRV-DEMO-001',
        email: providerEmail,
        phone: '9876543211',
        passwordHash,
        authProvider: 'LOCAL',
        profileCompletionStatus: 'COMPLETE',
        serviceType: 'Emergency 24x7 ALS & BLS Fleet',
        address: 'Tonk Road, Lal Kothi',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        latitude: 26.8850,
        longitude: 75.8010,
        verificationStatus: 'VERIFIED',
        accountStatus: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Demo Ambulance Provider ready: ${provider.name} (${provider.email})`);

  // 4. Seed Demo Ambulance
  const ambulanceReg = 'AMB-DEMO-ALS-01';
  const ambulance = await AmbulanceModel.findOneAndUpdate(
    { registrationNumber: ambulanceReg },
    {
      $set: {
        registrationNumber: ambulanceReg,
        vehicleNumber: 'RJ-14-EA-1001',
        providerId: provider._id,
        ambulanceType: 'ALS',
        capabilities: ['ICU', 'Ventilator', 'Defibrillator', 'Oxygen', 'Cardiac Monitor', 'Suction Unit'],
        currentStatus: 'OFFLINE',
        currentLatitude: 26.8950,
        currentLongitude: 75.8020,
        location: {
          type: 'Point',
          coordinates: [75.8020, 26.8950],
        },
        locationUpdatedAt: new Date(),
        locationSourceTimestamp: new Date(),
        locationAccuracyMeters: 10,
        serviceArea: 'Jaipur Metropolitan',
        verificationStatus: 'VERIFIED',
        accountStatus: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Demo Ambulance ready: ${ambulance.vehicleNumber} (${ambulance.registrationNumber})`);

  // 5. Seed Demo Ambulance Driver (Assigned to Demo Ambulance)
  const driverEmail = 'demo.driver@resq.local';
  const driver = await AmbulanceDriverModel.findOneAndUpdate(
    { email: driverEmail },
    {
      $set: {
        fullName: 'Rajesh Sharma (Demo Driver)',
        email: driverEmail,
        phone: '9876543212',
        passwordHash,
        authProvider: 'LOCAL',
        licenseNumber: 'DL-RJ-2024-998877',
        licenseVerificationStatus: 'VERIFIED',
        profileCompletionStatus: 'COMPLETE',
        address: 'Tonk Phatak',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        registeredLatitude: 26.8950,
        registeredLongitude: 75.8020,
        providerId: provider._id,
        assignedAmbulanceId: ambulance._id,
        availabilityStatus: 'OFFLINE',
        accountStatus: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Demo Driver ready: ${driver.fullName} (${driver.email})`);

  console.log('\n🎉 All Demo Accounts successfully seeded and verified!');
  console.log('----------------------------------------------------');
  console.log('🔑 Unified Demo Password for all accounts: ' + DEMO_PASSWORD);
  console.log('1. User/Citizen:       ' + userEmail);
  console.log('2. Hospital Staff:     ' + hospitalEmail);
  console.log('3. Ambulance Provider: ' + providerEmail);
  console.log('4. Ambulance Driver:   ' + driverEmail);
  console.log('5. Administrator:      admin@resq.local (Shubh@m2006734013)');
  console.log('----------------------------------------------------');
};

seedDemoData()
  .catch((err) => {
    console.error('❌ Demo seeding failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
