import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { HospitalAppointmentAvailabilityModel } from '../models/HospitalAppointmentAvailability.js';
import { HospitalAppointmentModel } from '../models/HospitalAppointment.js';
import { HospitalCareRequestModel } from '../models/HospitalCareRequest.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { TripModel } from '../models/Trip.js';

const BCRYPT_ROUNDS = 10;
const DEMO_PASSWORD = 'Password@123';

export const seedDemoData = async () => {
  await connectDatabase();
  console.log('🌱 Starting Comprehensive ResQ 2.0 Jaipur Demo Seeding...');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  // -------------------------------------------------------------------------
  // 1. Seed Administrator User (Guarantees Admin portal login)
  // -------------------------------------------------------------------------
  const adminEmail = (env.RESQ_ADMIN_EMAIL || 'admin@resq.local').trim().toLowerCase();
  const adminPasswordHash = await bcrypt.hash(env.RESQ_ADMIN_PASSWORD || 'Shubh@m2006734013', BCRYPT_ROUNDS);
  const admin = await UserModel.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: {
        name: 'ResQ System Administrator',
        email: adminEmail,
        phone: '9876543200',
        passwordHash: adminPasswordHash,
        authProvider: 'LOCAL',
        role: 'ADMIN',
        address: 'ResQ Command HQ, C-Scheme',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        latitude: 26.9124,
        longitude: 75.7873,
        accountStatus: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Administrator ready: ${admin.email} (ID: ${admin._id})`);

  // -------------------------------------------------------------------------
  // 2. Seed Demo Citizens / Users
  // -------------------------------------------------------------------------
  const user1Email = 'demo.user@resq.local';
  const citizen1 = await UserModel.findOneAndUpdate(
    { email: user1Email },
    {
      $set: {
        name: 'Demo Citizen (Shubham)',
        email: user1Email,
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
  console.log(`✅ Demo Citizen 1 ready: ${citizen1.email} (ID: ${citizen1._id})`);

  const user2Email = 'citizen.priya@resq.local';
  const citizen2 = await UserModel.findOneAndUpdate(
    { email: user2Email },
    {
      $set: {
        name: 'Priya Sharma (Demo Citizen)',
        email: user2Email,
        phone: '9876543220',
        passwordHash,
        authProvider: 'LOCAL',
        role: 'USER',
        address: 'Vaishali Nagar, Block B',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        latitude: 26.9015,
        longitude: 75.7420,
        accountStatus: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Demo Citizen 2 ready: ${citizen2.email} (ID: ${citizen2._id})`);

  // -------------------------------------------------------------------------
  // 3. Seed Realistic Jaipur Hospitals (Verified Network)
  // -------------------------------------------------------------------------
  const verifiedHospitals = [
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

  const seededHospitals: Record<string, InstanceType<typeof HospitalModel>> = {};

  for (const h of verifiedHospitals) {
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
    seededHospitals[h.registrationNumber] = hospital;
    console.log(`✅ Verified Hospital ready: ${hospital.name} (${hospital.email})`);

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

  // -------------------------------------------------------------------------
  // 4. Seed Pending Hospital (For Admin Verification & Governance Testing)
  // -------------------------------------------------------------------------
  const pendingHospitalEmail = 'pending.hospital@resq.local';
  const pendingHospital = await HospitalModel.findOneAndUpdate(
    { email: pendingHospitalEmail },
    {
      $set: {
        name: 'Pink City Metro Care (Pending Review)',
        registrationNumber: 'HOSP-PENDING-07',
        email: pendingHospitalEmail,
        phone: '9876543219',
        passwordHash,
        address: 'Sindhi Camp, Station Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        latitude: 26.9205,
        longitude: 75.7912,
        location: { type: 'Point', coordinates: [75.7912, 26.9205] },
        hospitalType: 'Community Acute Care Hospital',
        services: ['Emergency', 'General Medicine', 'Pediatric', 'Pharmacy'],
        capabilities: ['Observation Ward', 'Urgent Care'],
        resourceSummary: new Map([['icuBeds', 4], ['emergencyBeds', 10], ['ventilators', 2]]),
        emergencyAvailability: 'WAIT_TIME_HIGH',
        publicContactInformation: 'Helpline: +91-141-2370001',
        operationalDescription: 'New community acute hospital currently undergoing verification and inspection.',
        verificationStatus: 'PENDING',
        accountStatus: 'PENDING',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`⏳ Pending Hospital ready for Admin Review: ${pendingHospital.name} (${pendingHospital.email})`);

  // -------------------------------------------------------------------------
  // 5. Seed Ambulance Providers (1 Verified, 1 Pending)
  // -------------------------------------------------------------------------
  const provider1Email = 'demo.provider@resq.local';
  const verifiedProvider = await AmbulanceProviderModel.findOneAndUpdate(
    { email: provider1Email },
    {
      $set: {
        name: 'Apex LifeCare Ambulances (Demo)',
        registrationNumber: 'PRV-DEMO-001',
        email: provider1Email,
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
  console.log(`✅ Verified Provider ready: ${verifiedProvider.name} (${verifiedProvider.email})`);

  const pendingProviderEmail = 'pending.provider@resq.local';
  const pendingProvider = await AmbulanceProviderModel.findOneAndUpdate(
    { email: pendingProviderEmail },
    {
      $set: {
        name: 'Marwar Emergency Fleet (Pending Review)',
        registrationNumber: 'PRV-PENDING-002',
        email: pendingProviderEmail,
        phone: '9876543231',
        passwordHash,
        authProvider: 'LOCAL',
        profileCompletionStatus: 'COMPLETE',
        serviceType: 'Regional Ambulance Network',
        address: 'Ajmer Road, 200 Feet Bypass',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        latitude: 26.8880,
        longitude: 75.7350,
        verificationStatus: 'PENDING',
        accountStatus: 'PENDING',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`⏳ Pending Provider ready for Admin Review: ${pendingProvider.name} (${pendingProvider.email})`);

  // -------------------------------------------------------------------------
  // 6. Seed Ambulance Fleet (ALS, BLS, and Pending)
  // -------------------------------------------------------------------------
  const amb1 = await AmbulanceModel.findOneAndUpdate(
    { registrationNumber: 'AMB-DEMO-ALS-01' },
    {
      $set: {
        registrationNumber: 'AMB-DEMO-ALS-01',
        vehicleNumber: 'RJ-14-EA-1001',
        providerId: verifiedProvider._id,
        ambulanceType: 'ALS',
        capabilities: ['ICU', 'Ventilator', 'Defibrillator', 'Oxygen', 'Cardiac Monitor', 'Suction Unit'],
        currentStatus: 'AVAILABLE',
        currentLatitude: 26.8950,
        currentLongitude: 75.8020,
        location: { type: 'Point', coordinates: [75.8020, 26.8950] },
        locationUpdatedAt: new Date(),
        locationSourceTimestamp: new Date(),
        locationAccuracyMeters: 8,
        serviceArea: 'Jaipur Metropolitan',
        verificationStatus: 'VERIFIED',
        accountStatus: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Verified ALS Ambulance ready: ${amb1.vehicleNumber} (${amb1.registrationNumber})`);

  const amb2 = await AmbulanceModel.findOneAndUpdate(
    { registrationNumber: 'AMB-DEMO-BLS-02' },
    {
      $set: {
        registrationNumber: 'AMB-DEMO-BLS-02',
        vehicleNumber: 'RJ-14-EA-1002',
        providerId: verifiedProvider._id,
        ambulanceType: 'BLS',
        capabilities: ['Oxygen', 'First Aid Kit', 'Stretcher', 'Basic Monitor', 'BP Apparatus'],
        currentStatus: 'AVAILABLE',
        currentLatitude: 26.8620,
        currentLongitude: 75.8110,
        location: { type: 'Point', coordinates: [75.8110, 26.8620] },
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
  console.log(`✅ Verified BLS Ambulance ready: ${amb2.vehicleNumber} (${amb2.registrationNumber})`);

  const ambPending = await AmbulanceModel.findOneAndUpdate(
    { registrationNumber: 'AMB-PENDING-03' },
    {
      $set: {
        registrationNumber: 'AMB-PENDING-03',
        vehicleNumber: 'RJ-14-EA-9999',
        providerId: pendingProvider._id,
        ambulanceType: 'BLS',
        capabilities: ['First Aid Kit', 'Stretcher'],
        currentStatus: 'OFFLINE',
        currentLatitude: 26.8880,
        currentLongitude: 75.7350,
        location: { type: 'Point', coordinates: [75.7350, 26.8880] },
        locationUpdatedAt: new Date(),
        serviceArea: 'Jaipur West',
        verificationStatus: 'PENDING',
        accountStatus: 'PENDING',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`⏳ Pending Ambulance ready: ${ambPending.vehicleNumber} (${ambPending.registrationNumber})`);

  // -------------------------------------------------------------------------
  // 7. Seed Ambulance Drivers (Assigned On-Duty & Pending)
  // -------------------------------------------------------------------------
  const driver1Email = 'demo.driver@resq.local';
  const driver1 = await AmbulanceDriverModel.findOneAndUpdate(
    { email: driver1Email },
    {
      $set: {
        fullName: 'Rajesh Sharma (Demo Driver)',
        email: driver1Email,
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
        providerId: verifiedProvider._id,
        assignedAmbulanceId: amb1._id,
        availabilityStatus: 'ONLINE',
        isOnDuty: true,
        accountStatus: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Verified Driver 1 ready: ${driver1.fullName} (${driver1.email})`);

  const driver2Email = 'driver.vikram@resq.local';
  const driver2 = await AmbulanceDriverModel.findOneAndUpdate(
    { email: driver2Email },
    {
      $set: {
        fullName: 'Vikram Singh (Demo Driver)',
        email: driver2Email,
        phone: '9876543222',
        passwordHash,
        authProvider: 'LOCAL',
        licenseNumber: 'DL-RJ-2023-554433',
        licenseVerificationStatus: 'VERIFIED',
        profileCompletionStatus: 'COMPLETE',
        address: 'Malviya Nagar, Sector 1',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        registeredLatitude: 26.8620,
        registeredLongitude: 75.8110,
        providerId: verifiedProvider._id,
        assignedAmbulanceId: amb2._id,
        availabilityStatus: 'ONLINE',
        isOnDuty: true,
        accountStatus: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`✅ Verified Driver 2 ready: ${driver2.fullName} (${driver2.email})`);

  const pendingDriverEmail = 'pending.driver@resq.local';
  const pendingDriver = await AmbulanceDriverModel.findOneAndUpdate(
    { email: pendingDriverEmail },
    {
      $set: {
        fullName: 'Amit Verma (Pending Driver)',
        email: pendingDriverEmail,
        phone: '9876543232',
        passwordHash,
        authProvider: 'LOCAL',
        licenseNumber: 'DL-RJ-2025-112233',
        licenseVerificationStatus: 'PENDING',
        profileCompletionStatus: 'COMPLETE',
        address: 'Civil Lines, Jaipur',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        registeredLatitude: 26.9050,
        registeredLongitude: 75.7890,
        providerId: pendingProvider._id,
        availabilityStatus: 'OFFLINE',
        isOnDuty: false,
        accountStatus: 'PENDING',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`⏳ Pending Driver ready for Admin Review: ${pendingDriver.fullName} (${pendingDriver.email})`);

  // -------------------------------------------------------------------------
  // 8. Seed Sample Appointments
  // -------------------------------------------------------------------------
  const smsHospital = seededHospitals['HOSP-DEMO-SMS-01'];
  const fortisHospital = seededHospitals['HOSP-DEMO-FORTIS-02'];
  const ehccHospital = seededHospitals['HOSP-DEMO-EHCC-03'];

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);

  const pastDate = new Date(now);
  pastDate.setDate(now.getDate() - 3);
  const pastDateStr = pastDate.toISOString().slice(0, 10);

  if (smsHospital) {
    await HospitalAppointmentModel.findOneAndUpdate(
      { appointmentCode: 'APT-DEMO-CONF-01' },
      {
        $set: {
          appointmentCode: 'APT-DEMO-CONF-01',
          userId: citizen1._id,
          hospitalId: smsHospital._id,
          slotId: new Types.ObjectId(),
          serviceDepartment: 'Cardiology',
          slotDate: tomorrowStr,
          startTime: '10:00',
          endTime: '10:30',
          slotDurationMinutes: 30,
          status: 'CONFIRMED',
          visitReason: 'Routine cardiovascular evaluation and blood pressure checkup',
          notes: 'Patient requested morning slot. Approved by hospital staff.',
          statusHistory: [
            {
              status: 'PENDING',
              timestamp: new Date(now.getTime() - 86400000),
              updatedBy: citizen1._id,
              role: 'USER',
              notes: 'Appointment requested via citizen portal',
            },
            {
              status: 'CONFIRMED',
              timestamp: new Date(now.getTime() - 43200000),
              updatedBy: smsHospital._id,
              role: 'HOSPITAL',
              notes: 'Confirmed by SMS Hospital Cardiology desk',
            },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }

  if (fortisHospital) {
    await HospitalAppointmentModel.findOneAndUpdate(
      { appointmentCode: 'APT-DEMO-PEND-02' },
      {
        $set: {
          appointmentCode: 'APT-DEMO-PEND-02',
          userId: citizen1._id,
          hospitalId: fortisHospital._id,
          slotId: new Types.ObjectId(),
          serviceDepartment: 'Orthopedics',
          slotDate: nextWeekStr,
          startTime: '11:00',
          endTime: '11:30',
          slotDurationMinutes: 30,
          status: 'PENDING',
          visitReason: 'Knee ligament discomfort during physical activity',
          statusHistory: [
            {
              status: 'PENDING',
              timestamp: now,
              updatedBy: citizen1._id,
              role: 'USER',
              notes: 'Pending hospital review',
            },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }

  if (ehccHospital) {
    await HospitalAppointmentModel.findOneAndUpdate(
      { appointmentCode: 'APT-DEMO-COMP-03' },
      {
        $set: {
          appointmentCode: 'APT-DEMO-COMP-03',
          userId: citizen2._id,
          hospitalId: ehccHospital._id,
          slotId: new Types.ObjectId(),
          serviceDepartment: 'Cardiology',
          slotDate: pastDateStr,
          startTime: '14:00',
          endTime: '14:30',
          slotDurationMinutes: 30,
          status: 'COMPLETED',
          visitReason: 'Post-angioplasty annual follow-up and treadmill stress test',
          notes: 'Consultation concluded successfully. Follow-up scheduled in 12 months.',
          statusHistory: [
            {
              status: 'PENDING',
              timestamp: new Date(pastDate.getTime() - 172800000),
              updatedBy: citizen2._id,
              role: 'USER',
            },
            {
              status: 'CONFIRMED',
              timestamp: new Date(pastDate.getTime() - 86400000),
              updatedBy: ehccHospital._id,
              role: 'HOSPITAL',
            },
            {
              status: 'COMPLETED',
              timestamp: pastDate,
              updatedBy: ehccHospital._id,
              role: 'HOSPITAL',
              notes: 'Doctor marked consultation completed',
            },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }
  console.log('✅ Sample Appointments ready (CONFIRMED, PENDING, COMPLETED)');

  // -------------------------------------------------------------------------
  // 9. Seed Direct Hospital Care Requests
  // -------------------------------------------------------------------------
  const narayanaHospital = seededHospitals['HOSP-DEMO-NARAYANA-05'];
  const manipalHospital = seededHospitals['HOSP-DEMO-MANIPAL-06'];

  if (narayanaHospital) {
    await HospitalCareRequestModel.findOneAndUpdate(
      { referenceId: 'REQ-DEMO-CARE-01' },
      {
        $set: {
          referenceId: 'REQ-DEMO-CARE-01',
          userId: citizen1._id,
          hospitalId: narayanaHospital._id,
          serviceDepartment: 'Oncology',
          requestType: 'SPECIALIST_CONSULTATION',
          visitReason: 'Second opinion consultation regarding histopathology report',
          preferredTiming: 'MORNING',
          contactPreference: 'PHONE',
          status: 'ACCEPTED',
          hospitalResponse: {
            notes: 'Our oncology coordinator will call to arrange priority slot on Thursday.',
            respondedAt: new Date(now.getTime() - 3600000),
            respondedBy: narayanaHospital._id,
          },
          statusHistory: [
            {
              status: 'PENDING',
              timestamp: new Date(now.getTime() - 7200000),
              updatedBy: citizen1._id,
              role: 'USER',
            },
            {
              status: 'ACCEPTED',
              timestamp: new Date(now.getTime() - 3600000),
              updatedBy: narayanaHospital._id,
              role: 'HOSPITAL',
              notes: 'Direct care request accepted by oncology clinical triage desk',
            },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }

  if (manipalHospital) {
    await HospitalCareRequestModel.findOneAndUpdate(
      { referenceId: 'REQ-DEMO-CARE-02' },
      {
        $set: {
          referenceId: 'REQ-DEMO-CARE-02',
          userId: citizen2._id,
          hospitalId: manipalHospital._id,
          serviceDepartment: 'General',
          requestType: 'GENERAL_CONSULTATION',
          visitReason: 'Persistent seasonal viral symptoms and request for lab testing',
          preferredTiming: 'AFTERNOON',
          contactPreference: 'IN_APP',
          status: 'PENDING',
          statusHistory: [
            {
              status: 'PENDING',
              timestamp: now,
              updatedBy: citizen2._id,
              role: 'USER',
              notes: 'Awaiting hospital clinical team response',
            },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }
  console.log('✅ Sample Direct Care Requests ready (ACCEPTED, PENDING)');

  // -------------------------------------------------------------------------
  // 10. Seed Emergency SOS Requests & Life-Cycle History
  // -------------------------------------------------------------------------
  if (smsHospital) {
    // 10A. Resolved Emergency Request with full dispatch and completed trip
    const emgResolved = await EmergencyRequestModel.findOneAndUpdate(
      { requestCode: 'EMG-DEMO-RES-01' },
      {
        $set: {
          requestCode: 'EMG-DEMO-RES-01',
          userId: citizen1._id,
          hospitalId: smsHospital._id,
          situationType: 'CHEST_PAIN',
          category: 'chest_pain',
          reportedAt: new Date(now.getTime() - 86400000),
          location: 'Sector 4, Malviya Nagar, Jaipur',
          latitude: 26.8529,
          longitude: 75.8055,
          status: 'RESOLVED',
          ambulanceId: amb1._id,
          ambulanceProviderId: verifiedProvider._id,
          driverId: driver1._id,
          etaMinutes: 0,
          routeDistanceMeters: 4200,
          statusHistory: [
            { status: 'RECEIVED', changedAt: new Date(now.getTime() - 86400000), actorId: citizen1._id, actorRole: 'USER' },
            { status: 'REVIEWING', changedAt: new Date(now.getTime() - 86280000), actorId: smsHospital._id, actorRole: 'HOSPITAL', previousStatus: 'RECEIVED' },
            { status: 'PREPARING', changedAt: new Date(now.getTime() - 86100000), actorId: smsHospital._id, actorRole: 'HOSPITAL', previousStatus: 'REVIEWING' },
            { status: 'AMBULANCE_COORDINATION', changedAt: new Date(now.getTime() - 85800000), actorId: verifiedProvider._id, actorRole: 'AMBULANCE_PROVIDER', previousStatus: 'PREPARING' },
            { status: 'RESOLVED', changedAt: new Date(now.getTime() - 82800000), actorId: smsHospital._id, actorRole: 'HOSPITAL', previousStatus: 'AMBULANCE_COORDINATION' },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    await HospitalPatientModel.findOneAndUpdate(
      { caseId: 'CASE-DEMO-01' },
      {
        $set: {
          caseId: 'CASE-DEMO-01',
          hospitalId: smsHospital._id,
          emergencyId: emgResolved._id,
          ambulanceId: amb1._id,
          coordinationStatus: 'RESOLVED',
          emergencyType: 'CHEST_PAIN',
          etaMinutes: 0,
          receivedAt: new Date(now.getTime() - 86400000),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    await TripModel.findOneAndUpdate(
      { emergencyRequestId: emgResolved._id },
      {
        $set: {
          emergencyRequestId: emgResolved._id,
          providerId: verifiedProvider._id,
          ambulanceId: amb1._id,
          driverId: driver1._id,
          destinationHospitalId: smsHospital._id,
          status: 'COMPLETED',
          acceptedAt: new Date(now.getTime() - 85800000),
          arrivedAtPickupAt: new Date(now.getTime() - 85200000),
          patientPickedUpAt: new Date(now.getTime() - 84600000),
          arrivedAtHospitalAt: new Date(now.getTime() - 83400000),
          completedAt: new Date(now.getTime() - 82800000),
          statusHistory: [
            { status: 'ASSIGNED', changedAt: new Date(now.getTime() - 85800000), actorRole: 'SYSTEM' },
            { status: 'ACCEPTED', changedAt: new Date(now.getTime() - 85700000), actorRole: 'AMBULANCE_DRIVER', previousStatus: 'ASSIGNED' },
            { status: 'TO_PICKUP', changedAt: new Date(now.getTime() - 85600000), actorRole: 'AMBULANCE_DRIVER', previousStatus: 'ACCEPTED' },
            { status: 'AT_PICKUP', changedAt: new Date(now.getTime() - 85200000), actorRole: 'AMBULANCE_DRIVER', previousStatus: 'TO_PICKUP' },
            { status: 'PATIENT_ONBOARD', changedAt: new Date(now.getTime() - 84600000), actorRole: 'AMBULANCE_DRIVER', previousStatus: 'AT_PICKUP' },
            { status: 'TO_HOSPITAL', changedAt: new Date(now.getTime() - 84500000), actorRole: 'AMBULANCE_DRIVER', previousStatus: 'PATIENT_ONBOARD' },
            { status: 'AT_HOSPITAL', changedAt: new Date(now.getTime() - 83400000), actorRole: 'AMBULANCE_DRIVER', previousStatus: 'TO_HOSPITAL' },
            { status: 'COMPLETED', changedAt: new Date(now.getTime() - 82800000), actorRole: 'HOSPITAL', previousStatus: 'AT_HOSPITAL' },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }

  if (fortisHospital) {
    // 10B. Cancelled Emergency Request
    const emgCancelled = await EmergencyRequestModel.findOneAndUpdate(
      { requestCode: 'EMG-DEMO-CAN-02' },
      {
        $set: {
          requestCode: 'EMG-DEMO-CAN-02',
          userId: citizen2._id,
          hospitalId: fortisHospital._id,
          situationType: 'BREATHING_DIFFICULTY',
          category: 'breathing_difficulty',
          reportedAt: new Date(now.getTime() - 43200000),
          location: 'JLN Marg, Near Jawahar Kala Kendra, Jaipur',
          latitude: 26.8820,
          longitude: 75.8120,
          status: 'CANCELLED',
          statusHistory: [
            { status: 'RECEIVED', changedAt: new Date(now.getTime() - 43200000), actorId: citizen2._id, actorRole: 'USER' },
            { status: 'CANCELLED', changedAt: new Date(now.getTime() - 42600000), actorId: citizen2._id, actorRole: 'USER', previousStatus: 'RECEIVED' },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    await HospitalPatientModel.findOneAndUpdate(
      { caseId: 'CASE-DEMO-02' },
      {
        $set: {
          caseId: 'CASE-DEMO-02',
          hospitalId: fortisHospital._id,
          emergencyId: emgCancelled._id,
          coordinationStatus: 'CANCELLED',
          emergencyType: 'BREATHING_DIFFICULTY',
          receivedAt: new Date(now.getTime() - 43200000),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }

  if (ehccHospital) {
    // 10C. Active Emergency Request (In Triage / Reviewing)
    const emgActive = await EmergencyRequestModel.findOneAndUpdate(
      { requestCode: 'EMG-DEMO-ACT-03' },
      {
        $set: {
          requestCode: 'EMG-DEMO-ACT-03',
          userId: citizen1._id,
          hospitalId: ehccHospital._id,
          situationType: 'TRAUMA_ACCIDENT',
          category: 'accident_injury',
          reportedAt: new Date(now.getTime() - 600000),
          location: 'Jawahar Circle, Jaipur',
          latitude: 26.8458,
          longitude: 75.8035,
          status: 'REVIEWING',
          etaMinutes: 6,
          statusHistory: [
            { status: 'RECEIVED', changedAt: new Date(now.getTime() - 600000), actorId: citizen1._id, actorRole: 'USER' },
            { status: 'REVIEWING', changedAt: new Date(now.getTime() - 300000), actorId: ehccHospital._id, actorRole: 'HOSPITAL', previousStatus: 'RECEIVED' },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    await HospitalPatientModel.findOneAndUpdate(
      { caseId: 'CASE-DEMO-03' },
      {
        $set: {
          caseId: 'CASE-DEMO-03',
          hospitalId: ehccHospital._id,
          emergencyId: emgActive._id,
          coordinationStatus: 'INCOMING',
          emergencyType: 'TRAUMA_ACCIDENT',
          etaMinutes: 6,
          receivedAt: new Date(now.getTime() - 600000),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }
  console.log('✅ Sample Emergency SOS Requests ready (RESOLVED, CANCELLED, ACTIVE)');

  console.log('\n=============================================================');
  console.log('🎉 RESQ 2.0 JAIPUR DEMO SEEDING COMPLETED SUCCESSFULLY!');
  console.log('=============================================================');
  console.log('🔑 Unified Demo Password: ' + DEMO_PASSWORD);
  console.log('-------------------------------------------------------------');
  console.log('1. Admin:              ' + adminEmail + ' (or ' + (env.RESQ_ADMIN_PASSWORD ? 'configured env' : DEMO_PASSWORD) + ')');
  console.log('2. Citizen (User):     ' + user1Email + ' / ' + user2Email);
  console.log('3. Hospital (SMS):     demo.hospital@resq.local (and 5 other verified hospitals)');
  console.log('4. Pending Hospital:   ' + pendingHospitalEmail + ' [For Admin Approval Testing]');
  console.log('5. Ambulance Provider: ' + provider1Email);
  console.log('6. Pending Provider:   ' + pendingProviderEmail + ' [For Admin Approval Testing]');
  console.log('7. Ambulance Driver:   ' + driver1Email + ' (ALS) / ' + driver2Email + ' (BLS)');
  console.log('8. Pending Driver:     ' + pendingDriverEmail + ' [For Admin Approval Testing]');
  console.log('=============================================================\n');
};

seedDemoData()
  .catch((err) => {
    console.error('❌ Demo seeding failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
