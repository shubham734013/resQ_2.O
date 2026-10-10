/**
 * ResQ test-data integrity repair.
 *
 * Run from server/: npx tsx src/scripts/repairTestData.ts
 *
 * Non-destructive: never deletes documents. Fills missing required fields,
 * repairs invalid status enum values and dangling provider references, and
 * creates deterministic synthetic drivers. Synthetic accounts remain PENDING
 * and OFFLINE; this script never marks facilities/providers as verified.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase, sanitizeMongoUri } from '../config/database.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceModel } from '../models/Ambulance.js';

const DRIVER_TARGET_COUNT = 100;
const ACCOUNT_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'];
const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const suffix = (id: unknown): string => String(id).replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase();
const syntheticEmail = (kind: string, id: unknown): string =>
  `resq.test.${kind}.${suffix(id).toLowerCase()}@example.com`;
const testPhone = (id: unknown): string =>
  `900${suffix(id).replace(/[^0-9]/g, '').slice(-7).padStart(7, '0')}`;

async function main(): Promise<void> {
  await connectDatabase();
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
  console.log('Non-destructive repair started. No records will be deleted or activated.');

  let hospitalsUpdated = 0;
  const hospitals = await HospitalModel.collection.find({}).toArray();
  for (const doc of hospitals) {
    const set: Record<string, unknown> = {};
    const idSuffix = suffix(doc._id);
    if (!isText(doc.registrationNumber)) set.registrationNumber = `TEST-HOSP-${idSuffix}`;
    if (!isText(doc.email)) set.email = syntheticEmail('hospital', doc._id);
    if (!isText(doc.phone)) set.phone = testPhone(doc._id);
    if (!isText(doc.passwordHash)) {
      set.passwordHash = await bcrypt.hash(`DisabledTestOnly-Hospital-${idSuffix}-${cryptoRandom()}`, 12);
    }
    if (!isText(doc.hospitalType)) set.hospitalType = 'TEST_FIXTURE';
    if (!Array.isArray(doc.services)) set.services = [];
    if (!Array.isArray(doc.capabilities)) set.capabilities = [];
    if (!doc.resourceSummary || typeof doc.resourceSummary !== 'object') set.resourceSummary = {};
    if (!['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN'].includes(String(doc.emergencyAvailability))) {
      set.emergencyAvailability = 'UNKNOWN';
    }
    if (!VERIFICATION_STATUSES.includes(String(doc.verificationStatus))) set.verificationStatus = 'PENDING';
    if (!ACCOUNT_STATUSES.includes(String(doc.accountStatus))) set.accountStatus = 'PENDING';
    if (Object.keys(set).length) {
      try {
        await HospitalModel.collection.updateOne({ _id: doc._id }, { $set: set });
        hospitalsUpdated++;
      } catch (error) {
        console.error(`Hospital ${String(doc._id)} skipped (check unique fields): ${errorMessage(error)}`);
      }
    }
  }

  // Ensure existing provider records have schema-required fields, without changing valid statuses.
  let providersUpdated = 0;
  const providerDocs = await AmbulanceProviderModel.collection.find({}).toArray();
  for (const doc of providerDocs) {
    const set: Record<string, unknown> = {};
    const idSuffix = suffix(doc._id);
    if (!isText(doc.name)) set.name = `ResQ Test Provider ${idSuffix}`;
    if (!isText(doc.registrationNumber)) set.registrationNumber = `TEST-PROVIDER-${idSuffix}`;
    if (!isText(doc.email)) set.email = syntheticEmail('provider', doc._id);
    if (!isText(doc.phone)) set.phone = testPhone(doc._id);
    if (!isText(doc.serviceType)) set.serviceType = 'TEST_FIXTURE';
    if (!isText(doc.authProvider)) set.authProvider = 'LOCAL';
    if (!isText(doc.profileCompletionStatus)) set.profileCompletionStatus = 'INCOMPLETE';
    if (!VERIFICATION_STATUSES.includes(String(doc.verificationStatus))) set.verificationStatus = 'PENDING';
    if (!ACCOUNT_STATUSES.includes(String(doc.accountStatus))) set.accountStatus = 'PENDING';
    if (Object.keys(set).length) {
      try {
        await AmbulanceProviderModel.collection.updateOne({ _id: doc._id }, { $set: set });
        providersUpdated++;
      } catch (error) {
        console.error(`Provider ${String(doc._id)} skipped (check unique fields): ${errorMessage(error)}`);
      }
    }
  }

  const providers = await AmbulanceProviderModel.find({}).select('_id').lean();
  if (!providers.length) {
    throw new Error('No provider documents exist. Create test providers first; the script will not fabricate ObjectIds.');
  }
  const validProviderIds = providers.map((provider) => provider._id);
  const validProviderIdSet = new Set(validProviderIds.map(String));

  let ambulancesUpdated = 0;
  const ambulances = await AmbulanceModel.collection.find({}).toArray();
  for (let i = 0; i < ambulances.length; i++) {
    const doc = ambulances[i];
    if (!doc) continue;
    const set: Record<string, unknown> = {};
    const idSuffix = suffix(doc._id);
    if (!isText(doc.registrationNumber)) set.registrationNumber = `TEST-AMB-REG-${idSuffix}`;
    if (!isText(doc.vehicleNumber)) set.vehicleNumber = `TEST-AMB-VEH-${idSuffix}`;
    if (!isText(doc.ambulanceType)) set.ambulanceType = 'TEST_FIXTURE';
    if (!Array.isArray(doc.capabilities)) set.capabilities = [];
    if (!doc.providerId || !validProviderIdSet.has(String(doc.providerId))) {
      set.providerId = validProviderIds[i % validProviderIds.length];
    }
    if (!['AVAILABLE', 'BUSY', 'OFFLINE', 'MAINTENANCE'].includes(String(doc.currentStatus))) {
      set.currentStatus = 'OFFLINE';
    }
    if (!VERIFICATION_STATUSES.includes(String(doc.verificationStatus))) set.verificationStatus = 'PENDING';
    if (!ACCOUNT_STATUSES.includes(String(doc.accountStatus))) set.accountStatus = 'PENDING';
    if (Object.keys(set).length) {
      try {
        await AmbulanceModel.collection.updateOne({ _id: doc._id }, { $set: set });
        ambulancesUpdated++;
      } catch (error) {
        console.error(`Ambulance ${String(doc._id)} skipped (check unique fields): ${errorMessage(error)}`);
      }
    }
  }

  // Idempotently create a deterministic set of synthetic test drivers.
  const existingDrivers = await AmbulanceDriverModel.find({}).select('email licenseNumber').lean();
  const existingEmails = new Set(existingDrivers.map((driver) => String(driver.email || '').toLowerCase()));
  const existingLicenses = new Set(existingDrivers.map((driver) => String(driver.licenseNumber || '').toUpperCase()));
  let driversInserted = 0;
  for (let n = 1; n <= DRIVER_TARGET_COUNT; n++) {
    const sequence = String(n).padStart(3, '0');
    const email = `resq.test.driver.${sequence}@example.com`;
    const licenseNumber = `TEST-DL-${sequence}`;
    if (existingEmails.has(email.toLowerCase()) || existingLicenses.has(licenseNumber)) continue;
    const providerId = validProviderIds[(n - 1) % validProviderIds.length];
    const assignedAmbulance = await AmbulanceModel.findOne({ providerId }).select('_id').lean();
    const passwordHash = await bcrypt.hash(`DisabledTestOnly-Driver-${sequence}-${cryptoRandom()}`, 12);
    try {
      await AmbulanceDriverModel.create({
        fullName: `ResQ Test Driver ${sequence}`,
        email,
        phone: `901${sequence.padStart(7, '0')}`,
        passwordHash,
        authProvider: 'LOCAL',
        licenseNumber,
        licenseVerificationStatus: 'PENDING',
        profileCompletionStatus: 'INCOMPLETE',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        providerId,
        ...(assignedAmbulance ? { assignedAmbulanceId: assignedAmbulance._id } : {}),
        availabilityStatus: 'OFFLINE',
        accountStatus: 'PENDING',
      });
      driversInserted++;
      existingEmails.add(email.toLowerCase());
      existingLicenses.add(licenseNumber);
    } catch (error) {
      console.error(`Driver fixture ${sequence} skipped: ${errorMessage(error)}`);
    }
  }

  console.log('\nRepair summary');
  console.log(`Hospitals scanned: ${hospitals.length}; updated: ${hospitalsUpdated}`);
  console.log(`Providers scanned: ${providerDocs.length}; updated: ${providersUpdated}`);
  console.log(`Ambulances scanned: ${ambulances.length}; updated: ${ambulancesUpdated}`);
  console.log(`Drivers before: ${existingDrivers.length}; synthetic drivers inserted: ${driversInserted}`);
  console.log('Synthetic records remain PENDING/OFFLINE. Real coordinates and real registrations were not fabricated.');
  console.log('Next: npm run audit:db');
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 12);
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? sanitizeMongoUri(error.message) : 'Unknown error';
}

main()
  .catch((error: unknown) => {
    console.error('Test-data repair failed:', errorMessage(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
