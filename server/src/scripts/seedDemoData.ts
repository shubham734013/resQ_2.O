import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/User.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { HospitalAppointmentAvailabilityModel } from '../models/HospitalAppointmentAvailability.js';

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

  // 2. Seed Realistic Jaipur Demo Hospitals
  const demoHospitals = [
    {
      name: 'SMS Multispeciality & Trauma Hospital (Demo)',
      registrationNumber: 'HOSP-DEMO-SMS-01',
      email: 'demo.hospital@resq.local',
      phone: '9876543213',
      address: 'Jawaharlal Nehru Marg, Ashok Nagar',
      city: 'Jaipur',
      state: 'Rajasthan',
      country: 'India',
      latitude: 26.8917,
      longitude: 75.8155,
      location: { type: 'Point' as const, coordinates: [75.8155, 26.8917] as [number, number] },
      hospitalType: 'Government Multispeciality & Trauma',
      services: ['Emergency', 'Trauma', 'Cardiology', 'Neurology', 'Pediatric', 'ICU', 'Burn Care', 'Orthopedics', 'General Medicine'],
      capabilities: ['24/7 Trauma Unit', 'Cath Lab', 'Emergency Surgery', 'Cardiac ICU', 'Pediatric ICU'],
      resourceSummary: new Map([['icuBeds', 12], ['emergencyBeds', 24], ['ventilators', 8], ['operationTheatres', 6]]),
      emergencyAvailability: 'AVAILABLE' as const,
      publicContactInformation: '24/7 Emergency Line: +91-141-2560291',
      operationalDescription: 'Level 1 Trauma Center with 24/7 active emergency intake and resuscitation teams.',
      appointmentDepartments: ['General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Neurology', 'Emergency'],
    },
    {
      name: 'Fortis Escorts Hospital (Jaipur)',
      registrationNumber: 'HOSP-DEMO-FORTIS-02',
      email: 'fortis.jaipur@resq.local',
      phone: '9876543214',
      address: 'JLN Marg, Sector 5, Malviya Nagar',
      city: 'Jaipur',
      state: 'Rajasthan',
      country: 'India',
      latitude: 26.8521,
      longitude: 75.8078,
      location: { type: 'Point' as const, coordinates: [75.8078, 26.8521] as [number, number] },
      hospitalType: 'Private Multispeciality & Cardiology Super-Specialty',
      services: ['Emergency', 'Cardiology', 'Cardiac Surgery', 'Neurology', 'Orthopedics', 'ICU', 'Critical Care', 'Pulmonology'],
      capabilities: ['24/7 Cardiac Emergency', 'Cath Lab', 'Advanced ICU', 'Emergency Resuscitation', 'Stroke Center'],
      resourceSummary: new Map([['icuBeds', 20], ['emergencyBeds', 30], ['ventilators', 12], ['operationTheatres', 8]]),
      emergencyAvailability: 'AVAILABLE' as const,
      publicContactInformation: '24/7 Emergency: +91-141-2547000',
      operationalDescription: 'JCI and NABH accredited tertiary cardiac and critical care super-specialty hospital.',
      appointmentDepartments: ['Cardiology', 'Cardiac Surgery', 'Neurology', 'Orthopedics', 'Pulmonology'],
    },
    {
      name: 'Eternal Heart Care Centre & Hospital (EHCC)',
      registrationNumber: 'HOSP-DEMO-EHCC-03',
      email: 'ehcc.jaipur@resq.local',
      phone: '9876543215',
      address: 'Jawahar Circle, Malviya Nagar',
      city: 'Jaipur',
      state: 'Rajasthan',
      country: 'India',
      latitude: 26.8458,
      longitude: 75.8035,
      location: { type: 'Point' as const, coordinates: [75.8035, 26.8458] as [number, number] },
      hospitalType: 'Heart & Multispeciality Tertiary Care Hospital',
      services: ['Emergency', 'Cardiology', 'Heart Transplant', 'Trauma', 'Vascular Surgery', 'Radiology', 'Critical Care'],
      capabilities: ['24/7 Heart Attack Response', 'Advanced Cath Lab', 'CCU', 'ECMO Unit', 'Emergency Cardiac Unit'],
      resourceSummary: new Map([['icuBeds', 16], ['emergencyBeds', 20], ['ventilators', 10], ['operationTheatres', 5]]),
      emergencyAvailability: 'AVAILABLE' as const,
      publicContactInformation: '24/7 Hotline: +91-141-3966000',
      operationalDescription: 'Dedicated Heart Hospital and Tertiary Care Center equipped with advanced ECMO and Cath Labs.',
      appointmentDepartments: ['Cardiology', 'Vascular Surgery', 'Radiology', 'Critical Care'],
    },
    {
      name: 'Apex Hospital (Mansarovar)',
      registrationNumber: 'HOSP-DEMO-APEX-04',
      email: 'apex.jaipur@resq.local',
      phone: '9876543216',
      address: 'Sector 6, Mansarovar',
      city: 'Jaipur',
      state: 'Rajasthan',
      country: 'India',
      latitude: 26.8570,
      longitude: 75.7680,
      location: { type: 'Point' as const, coordinates: [75.7680, 26.8570] as [number, number] },
      hospitalType: 'Super Speciality Hospital & Trauma Care',
      services: ['Emergency', 'Trauma', 'Orthopaedics', 'Neurology', 'Pediatric', 'General Surgery', 'Nephrology'],
      capabilities: ['24/7 Trauma Service', 'Level 2 Trauma Care', 'Dialysis Unit', 'Pediatric ICU'],
      resourceSummary: new Map([['icuBeds', 14], ['emergencyBeds', 18], ['ventilators', 6], ['operationTheatres', 4]]),
      emergencyAvailability: 'AVAILABLE' as const,
      publicContactInformation: '24/7 Helpline: +91-141-2784920',
      operationalDescription: 'Leading super-specialty trauma and surgical care facility in Southwest Jaipur.',
      appointmentDepartments: ['Trauma', 'Orthopaedics', 'Pediatric', 'General Surgery', 'Nephrology'],
    },
    {
      name: 'Narayana Multispeciality Hospital',
      registrationNumber: 'HOSP-DEMO-NARAYANA-05',
      email: 'narayana.jaipur@resq.local',
      phone: '9876543217',
      address: 'Sector 28, Kumbha Marg, Pratap Nagar, Sanganer',
      city: 'Jaipur',
      state: 'Rajasthan',
      country: 'India',
      latitude: 26.7995,
      longitude: 75.8234,
      location: { type: 'Point' as const, coordinates: [75.8234, 26.7995] as [number, number] },
      hospitalType: 'Multispeciality Hospital',
      services: ['Emergency', 'Cardiology', 'Oncology', 'Neurology', 'Nephrology', 'Maternity', 'Pediatric', 'Urgent Care'],
      capabilities: ['24/7 Emergency Care', 'Oncology Care', 'Comprehensive Stroke Center', 'NICU / PICU', 'Maternity Unit'],
      resourceSummary: new Map([['icuBeds', 18], ['emergencyBeds', 25], ['ventilators', 8], ['operationTheatres', 6]]),
      emergencyAvailability: 'AVAILABLE' as const,
      publicContactInformation: '24/7 Desk: +91-141-7122222',
      operationalDescription: 'Comprehensive cancer, cardiac, maternal and neonatal emergency tertiary care hospital.',
      appointmentDepartments: ['Cardiology', 'Maternity', 'Pediatric', 'Oncology', 'Neurology', 'Urgent Care'],
    },
    {
      name: 'Manipal Hospital (Vidhyadhar Nagar)',
      registrationNumber: 'HOSP-DEMO-MANIPAL-06',
      email: 'manipal.jaipur@resq.local',
      phone: '9876543218',
      address: 'Sector 5, Main Sikar Road, Vidhyadhar Nagar',
      city: 'Jaipur',
      state: 'Rajasthan',
      country: 'India',
      latitude: 26.9667,
      longitude: 75.7761,
      location: { type: 'Point' as const, coordinates: [75.7761, 26.9667] as [number, number] },
      hospitalType: 'Tertiary Care Multispeciality Hospital',
      services: ['Emergency', 'Trauma', 'Urgent Care', 'Cardiology', 'Maternity', 'Orthopaedics', 'Pediatric', 'General'],
      capabilities: ['24/7 Acute Care', 'Trauma ICU', 'Maternity Emergency', 'Advanced Life Support', 'Laparoscopic Surgery'],
      resourceSummary: new Map([['icuBeds', 15], ['emergencyBeds', 22], ['ventilators', 7], ['operationTheatres', 5]]),
      emergencyAvailability: 'AVAILABLE' as const,
      publicContactInformation: '24/7 Helpline: +91-141-5164000',
      operationalDescription: 'Premier acute emergency, orthopedic and maternal trauma care hospital in North Jaipur.',
      appointmentDepartments: ['Emergency', 'Urgent Care', 'Maternity', 'Orthopaedics', 'General'],
    },
  ];

  for (const h of demoHospitals) {
    const { appointmentDepartments, ...hospitalData } = h;
    const hospital = await HospitalModel.findOneAndUpdate(
      { email: h.email },
      {
        $set: {
          ...hospitalData,
          passwordHash,
          verificationStatus: 'VERIFIED',
          accountStatus: 'ACTIVE',
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    console.log(`✅ Demo Hospital ready: ${hospital.name} (${hospital.email})`);

    // Seed appointment availability for each department
    for (const dept of appointmentDepartments) {
      await HospitalAppointmentAvailabilityModel.findOneAndUpdate(
        { hospitalId: hospital._id, department: dept },
        {
          $set: {
            hospitalId: hospital._id,
            department: dept,
            slotDurationMinutes: 30,
            maxCapacityPerSlot: 4,
            weeklySchedule: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
              dayOfWeek,
              isEnabled: true,
              startTime: '09:00',
              endTime: '17:00',
              breakStartTime: '13:00',
              breakEndTime: '14:00',
            })),
            blackoutDates: [],
            isActive: true,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
    }
  }

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
  console.log('2. Hospital Staff:     demo.hospital@resq.local (and 5 other Jaipur demo hospitals)');
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
