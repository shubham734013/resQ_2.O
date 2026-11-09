/**
 * ResQ test-data integrity repair.
 *
 * Run from server/: npx tsx src/scripts/repairTestData.ts [--dry-run]
 *
 * Non-destructive: never deletes documents. Fills missing required fields,
 * repairs invalid status enum values, dangling provider references, and
 * stray user fixtures without email.
 * Synthetic accounts remain PENDING and OFFLINE; this script never marks
 * facilities/providers as verified.
 */
import mongoose, { type Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase, sanitizeMongoUri } from '../config/database.js';
import { UserModel } from '../models/User.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AuditLogModel } from '../models/AuditLog.js';

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

export interface RepairOptions {
  dryRun?: boolean;
}

export interface RepairSummary {
  dryRun: boolean;
  usersScanned: number;
  usersRemediated: number;
  hospitalsScanned: number;
  hospitalsUpdated: number;
  providersScanned: number;
  providersUpdated: number;
  ambulancesScanned: number;
  ambulancesUpdated: number;
  driversScanned: number;
  driversRepaired: number;
  driversInserted: number;
}

export async function runTestDataRepair(options: RepairOptions = {}): Promise<RepairSummary> {
  const isDryRun = Boolean(options.dryRun);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (No writes will be performed)' : 'LIVE (Applying changes)'}`);
  console.log('Non-destructive repair started. No records will be deleted or activated.');

  // 1. Remediate stray or incomplete User records (e.g. fixtures missing email)
  let usersScanned = 0;
  let usersRemediated = 0;
  const userDocs = await UserModel.collection.find({}).toArray();
  usersScanned = userDocs.length;
  for (const doc of userDocs) {
    const set: Record<string, unknown> = {};
    const idSuffix = suffix(doc._id);
    if (!isText(doc.email)) {
      set.email = syntheticEmail('user.stray', doc._id);
    }
    if (!isText(doc.name)) {
      set.name = `ResQ Test User ${idSuffix}`;
    }
    if (!['USER', 'HOSPITAL', 'AMBULANCE_PROVIDER', 'AMBULANCE_DRIVER', 'ADMIN'].includes(String(doc.role))) {
      set.role = 'USER';
    }
    if (!['LOCAL', 'GOOGLE', 'MICROSOFT'].includes(String(doc.authProvider))) {
      set.authProvider = 'LOCAL';
    }
    if (!ACCOUNT_STATUSES.includes(String(doc.accountStatus))) {
      set.accountStatus = 'PENDING';
    }
    if (typeof doc.emailVerified !== 'boolean') set.emailVerified = false;
    if (typeof doc.phoneVerified !== 'boolean') set.phoneVerified = false;
    if (!Array.isArray(doc.savedFacilityIds)) set.savedFacilityIds = [];
    if (!isText(doc.passwordHash)) {
      set.passwordHash = await bcrypt.hash(`DisabledTestOnly-User-${idSuffix}-${cryptoRandom()}`, 12);
    }

    if (Object.keys(set).length) {
      if (isDryRun) {
        console.log(`[DRY-RUN] User ${String(doc._id)} would be remediated with: ${JSON.stringify(set)}`);
        usersRemediated++;
      } else {
        try {
          await UserModel.collection.updateOne({ _id: doc._id }, { $set: set });
          try {
            await AuditLogModel.create({
              actorRole: 'SYSTEM',
              action: 'REMEDIATE_STRAY_USER_FIXTURE',
              entityType: 'USER',
              entityId: doc._id as Types.ObjectId,
              previousState: doc as Record<string, unknown>,
              newState: set,
              reason: 'Remediated missing required fields in stray User_Data fixture document',
              createdAt: new Date(),
            });
          } catch (auditErr) {
            console.warn(`AuditLog creation notice for User ${String(doc._id)}: ${errorMessage(auditErr)}`);
          }
          usersRemediated++;
        } catch (error) {
          console.error(`User ${String(doc._id)} remediation skipped: ${errorMessage(error)}`);
        }
      }
    }
  }

  // 2. Ensure hospital records have schema-required fields
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
      if (isDryRun) {
        console.log(`[DRY-RUN] Hospital ${String(doc._id)} would be updated: ${JSON.stringify(set)}`);
        hospitalsUpdated++;
      } else {
        try {
          await HospitalModel.collection.updateOne({ _id: doc._id }, { $set: set });
          hospitalsUpdated++;
        } catch (error) {
          console.error(`Hospital ${String(doc._id)} skipped (check unique fields): ${errorMessage(error)}`);
        }
      }
    }
  }

  // 3. Ensure existing provider records have schema-required fields
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
      if (isDryRun) {
        console.log(`[DRY-RUN] Provider ${String(doc._id)} would be updated: ${JSON.stringify(set)}`);
        providersUpdated++;
      } else {
        try {
          await AmbulanceProviderModel.collection.updateOne({ _id: doc._id }, { $set: set });
          providersUpdated++;
        } catch (error) {
          console.error(`Provider ${String(doc._id)} skipped (check unique fields): ${errorMessage(error)}`);
        }
      }
    }
  }

  const providers = await AmbulanceProviderModel.find({}).select('_id').lean();
  if (!providers.length) {
    throw new Error('No provider documents exist. Create test providers first; the script will not fabricate ObjectIds.');
  }
  const validProviderIds = providers.map((provider) => provider._id);
  const validProviderIdSet = new Set(validProviderIds.map(String));

  // 4. Ensure ambulances have schema-required fields & valid provider linkages
  let ambulancesUpdated = 0;
  const ambulances = await AmbulanceModel.collection.find({}).toArray();
  for (const doc of ambulances) {
    const set: Record<string, unknown> = {};
    const idSuffix = suffix(doc._id);
    if (!isText(doc.registrationNumber)) set.registrationNumber = `TEST-AMB-REG-${idSuffix}`;
    if (!isText(doc.vehicleNumber)) set.vehicleNumber = `TEST-AMB-VEH-${idSuffix}`;
    if (!isText(doc.ambulanceType)) set.ambulanceType = 'TEST_FIXTURE';
    if (!Array.isArray(doc.capabilities)) set.capabilities = [];
    if (!doc.providerId || !validProviderIdSet.has(String(doc.providerId))) {
      set.providerId = validProviderIds[ambulancesUpdated % validProviderIds.length];
    }
    if (!['AVAILABLE', 'BUSY', 'OFFLINE', 'MAINTENANCE'].includes(String(doc.currentStatus))) {
      set.currentStatus = 'OFFLINE';
    }
    if (!VERIFICATION_STATUSES.includes(String(doc.verificationStatus))) set.verificationStatus = 'PENDING';
    if (!ACCOUNT_STATUSES.includes(String(doc.accountStatus))) set.accountStatus = 'PENDING';
    if (Object.keys(set).length) {
      if (isDryRun) {
        console.log(`[DRY-RUN] Ambulance ${String(doc._id)} would be updated: ${JSON.stringify(set)}`);
        ambulancesUpdated++;
      } else {
        try {
          await AmbulanceModel.collection.updateOne({ _id: doc._id }, { $set: set });
          ambulancesUpdated++;
        } catch (error) {
          console.error(`Ambulance ${String(doc._id)} skipped (check unique fields): ${errorMessage(error)}`);
        }
      }
    }
  }

  // 5. Ensure existing drivers have schema-required fields and matching provider-ambulance links
  let driversRepaired = 0;
  const existingDriverDocs = await AmbulanceDriverModel.collection.find({}).toArray();
  for (const driver of existingDriverDocs) {
    const set: Record<string, unknown> = {};
    const idSuffix = suffix(driver._id);
    if (!isText(driver.fullName)) set.fullName = `ResQ Test Driver ${idSuffix}`;
    if (!isText(driver.licenseNumber)) set.licenseNumber = `TEST-DL-${idSuffix}`;
    if (!isText(driver.email)) set.email = syntheticEmail('driver', driver._id);
    if (!isText(driver.phone)) set.phone = testPhone(driver._id);
    if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(String(driver.licenseVerificationStatus))) {
      set.licenseVerificationStatus = 'PENDING';
    }
    if (!ACCOUNT_STATUSES.includes(String(driver.accountStatus))) {
      set.accountStatus = 'PENDING';
    }
    if (!driver.providerId || !validProviderIdSet.has(String(driver.providerId))) {
      set.providerId = validProviderIds[driversRepaired % validProviderIds.length];
    }
    const currentProviderId = set.providerId || driver.providerId;
    if (driver.assignedAmbulanceId) {
      const assigned = await AmbulanceModel.findById(driver.assignedAmbulanceId).select('providerId').lean();
      if (!assigned || String(assigned.providerId) !== String(currentProviderId)) {
        // Find an ambulance belonging to driver's providerId
        const matchingAmb = await AmbulanceModel.findOne({ providerId: currentProviderId }).select('_id').lean();
        if (matchingAmb) {
          set.assignedAmbulanceId = matchingAmb._id;
        } else {
          set.assignedAmbulanceId = null;
        }
      }
    }
    if (Object.keys(set).length) {
      if (isDryRun) {
        console.log(`[DRY-RUN] Driver ${String(driver._id)} would be repaired: ${JSON.stringify(set)}`);
        driversRepaired++;
      } else {
        try {
          await AmbulanceDriverModel.collection.updateOne({ _id: driver._id }, { $set: set });
          driversRepaired++;
        } catch (error) {
          console.error(`Driver ${String(driver._id)} skipped: ${errorMessage(error)}`);
        }
      }
    }
  }

  // 6. Idempotently create deterministic synthetic drivers up to target count
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
    if (isDryRun) {
      console.log(`[DRY-RUN] Would create synthetic driver ${sequence} (${email})`);
      driversInserted++;
      existingEmails.add(email.toLowerCase());
      existingLicenses.add(licenseNumber);
    } else {
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
  }

  console.log('\nRepair summary');
  console.log(`Users scanned: ${usersScanned}; remediated: ${usersRemediated}`);
  console.log(`Hospitals scanned: ${hospitals.length}; updated: ${hospitalsUpdated}`);
  console.log(`Providers scanned: ${providerDocs.length}; updated: ${providersUpdated}`);
  console.log(`Ambulances scanned: ${ambulances.length}; updated: ${ambulancesUpdated}`);
  console.log(`Drivers scanned: ${existingDriverDocs.length}; existing repaired: ${driversRepaired}; synthetic drivers inserted: ${driversInserted}`);
  console.log('Synthetic records remain PENDING/OFFLINE. Real coordinates and real registrations were not fabricated.');

  return {
    dryRun: isDryRun,
    usersScanned,
    usersRemediated,
    hospitalsScanned: hospitals.length,
    hospitalsUpdated,
    providersScanned: providerDocs.length,
    providersUpdated,
    ambulancesScanned: ambulances.length,
    ambulancesUpdated,
    driversScanned: existingDriverDocs.length,
    driversRepaired,
    driversInserted,
  };
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 12);
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? sanitizeMongoUri(error.message) : 'Unknown error';
}

async function main(): Promise<void> {
  await connectDatabase();
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
  const isDryRun = process.argv.includes('--dry-run');
  await runTestDataRepair({ dryRun: isDryRun });
}

// Auto-run only if executed directly via CLI
if (process.argv[1]?.includes('repairTestData')) {
  main()
    .catch((error: unknown) => {
      console.error('Test-data repair failed:', errorMessage(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectDatabase();
    });
}
