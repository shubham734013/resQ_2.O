import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase, sanitizeMongoUri } from '../config/database.js';
import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';

export interface AuditIssue {
  severity: 'CRITICAL' | 'WARNING' | 'READINESS' | 'INFO';
  collection: string;
  documentId?: string;
  field?: string;
  issue: string;
}

export interface CollectionCounts {
  total: number;
  byRole?: Record<string, number>;
  byAccountStatus?: Record<string, number>;
  byVerificationStatus?: Record<string, number>;
  byOperationalStatus?: Record<string, number>;
}

export interface AuditReport {
  timestamp: string;
  databaseName: string;
  connected: boolean;
  counts: {
    users: CollectionCounts;
    hospitals: CollectionCounts;
    providers: CollectionCounts;
    drivers: CollectionCounts;
    ambulances: CollectionCounts;
    emergencyRequests: CollectionCounts;
    trips: CollectionCounts;
    hospitalPatients: CollectionCounts;
  };
  issues: AuditIssue[];
  summary: {
    totalDocuments: number;
    criticalIssues: number;
    warningIssues: number;
    readinessIssues: number;
    infoIssues: number;
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidCoordinate = (lat?: number | null, lng?: number | null): { valid: boolean; reason?: string } => {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return { valid: true };
  }
  if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
    return { valid: false, reason: `Latitude ${lat} is out of valid range [-90, 90]` };
  }
  if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
    return { valid: false, reason: `Longitude ${lng} is out of valid range [-180, 180]` };
  }
  return { valid: true };
};

const countBy = <T extends object>(items: T[], key: keyof T): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const item of items) {
    const raw = item[key];
    const val = raw !== undefined && raw !== null ? String(raw) : 'UNKNOWN';
    result[val] = (result[val] || 0) + 1;
  }
  return result;
};

export const findDuplicates = <T extends object>(
  items: T[],
  key: keyof T,
  collectionName: string,
  severity: AuditIssue['severity'] = 'CRITICAL',
): AuditIssue[] => {
  const issues: AuditIssue[] = [];
  const map = new Map<string, string[]>();

  for (const item of items) {
    const rawVal = item[key];
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;
    const normalized = String(rawVal).trim().toLowerCase();
    const id = '_id' in item ? String((item as { _id?: unknown })._id) : 'unknown';
    const existing = map.get(normalized) || [];
    existing.push(id);
    map.set(normalized, existing);
  }

  for (const [val, ids] of map.entries()) {
    if (ids.length > 1) {
      issues.push({
        severity,
        collection: collectionName,
        field: String(key),
        issue: `Duplicate value "${val}" found across ${ids.length} records: [${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''}]`,
      });
    }
  }

  return issues;
};

export const runDatabaseAudit = async (): Promise<AuditReport> => {
  const issues: AuditIssue[] = [];
  const dbName = mongoose.connection.name || 'resq';

  // Fetch all collections in parallel
  const [
    users,
    hospitals,
    providers,
    drivers,
    ambulances,
    emergencyRequests,
    trips,
    hospitalPatients,
  ] = await Promise.all([
    UserModel.find({}).lean(),
    HospitalModel.find({}).lean(),
    AmbulanceProviderModel.find({}).lean(),
    AmbulanceDriverModel.find({}).lean(),
    AmbulanceModel.find({}).lean(),
    EmergencyRequestModel.find({}).lean(),
    TripModel.find({}).lean(),
    HospitalPatientModel.find({}).lean(),
  ]);

  // Set lookup maps for reference integrity
  const providerMap = new Map(providers.map((p) => [String(p._id), p]));
  const ambulanceMap = new Map(ambulances.map((a) => [String(a._id), a]));
  const hospitalMap = new Map(hospitals.map((h) => [String(h._id), h]));
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const driverMap = new Map(drivers.map((d) => [String(d._id), d]));
  const emergencyMap = new Map(emergencyRequests.map((e) => [String(e._id), e]));

  // 1. Audit Users
  issues.push(...findDuplicates(users, 'email', 'User_Data'));
  for (const user of users) {
    const id = String(user._id);
    if (!user.name?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'User_Data', documentId: id, field: 'name', issue: 'Missing required field "name"' });
    }
    if (!user.email?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'User_Data', documentId: id, field: 'email', issue: 'Missing required field "email"' });
    } else if (!EMAIL_REGEX.test(user.email)) {
      issues.push({ severity: 'WARNING', collection: 'User_Data', documentId: id, field: 'email', issue: `Invalid email format "${user.email}"` });
    }

    const coordCheck = isValidCoordinate(user.latitude, user.longitude);
    if (!coordCheck.valid) {
      issues.push({ severity: 'WARNING', collection: 'User_Data', documentId: id, field: 'coordinates', issue: coordCheck.reason! });
    }

    if (user.email?.endsWith('@example.com') || user.email?.endsWith('@test.com')) {
      issues.push({ severity: 'INFO', collection: 'User_Data', documentId: id, field: 'email', issue: `Test fixture email detected: "${user.email}"` });
    }
  }

  // 2. Audit Hospitals
  issues.push(...findDuplicates(hospitals, 'email', 'Hospitals_data'));
  issues.push(...findDuplicates(hospitals, 'registrationNumber', 'Hospitals_data'));
  for (const hospital of hospitals) {
    const id = String(hospital._id);
    if (!hospital.name?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'Hospitals_data', documentId: id, field: 'name', issue: 'Missing required field "name"' });
    }
    if (!hospital.registrationNumber?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'Hospitals_data', documentId: id, field: 'registrationNumber', issue: 'Missing required field "registrationNumber"' });
    }
    if (!hospital.email?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'Hospitals_data', documentId: id, field: 'email', issue: 'Missing required field "email"' });
    } else if (!EMAIL_REGEX.test(hospital.email)) {
      issues.push({ severity: 'WARNING', collection: 'Hospitals_data', documentId: id, field: 'email', issue: `Invalid email format "${hospital.email}"` });
    }

    if (!hospital.address && !hospital.city) {
      issues.push({ severity: 'WARNING', collection: 'Hospitals_data', documentId: id, field: 'address', issue: 'Hospital has neither address nor city defined' });
    }

    const hasLatLng = typeof hospital.latitude === 'number' && typeof hospital.longitude === 'number';
    const hasLocation = hospital.location?.coordinates && hospital.location.coordinates.length === 2;
    if (!hasLatLng && !hasLocation) {
      if (hospital.verificationStatus === 'PENDING' || hospital.accountStatus === 'PENDING') {
        issues.push({ severity: 'READINESS', collection: 'Hospitals_data', documentId: id, field: 'coordinates', issue: 'Hospital is missing geographic coordinates (pending geocoding onboarding)' });
      } else {
        issues.push({ severity: 'WARNING', collection: 'Hospitals_data', documentId: id, field: 'coordinates', issue: 'Hospital is missing geographic coordinates' });
      }
    }

    const coordCheck = isValidCoordinate(hospital.latitude, hospital.longitude);
    if (!coordCheck.valid) {
      issues.push({ severity: 'CRITICAL', collection: 'Hospitals_data', documentId: id, field: 'coordinates', issue: coordCheck.reason! });
    }

    if (hospital.location) {
      if (hospital.location.type !== 'Point') {
        issues.push({ severity: 'WARNING', collection: 'Hospitals_data', documentId: id, field: 'location.type', issue: `GeoJSON type should be "Point", got "${hospital.location.type}"` });
      }
      const coords = hospital.location.coordinates;
      if (!Array.isArray(coords) || coords.length !== 2) {
        issues.push({ severity: 'CRITICAL', collection: 'Hospitals_data', documentId: id, field: 'location.coordinates', issue: 'GeoJSON coordinates must be a 2-element array [lng, lat]' });
      } else {
        const geoCheck = isValidCoordinate(coords[1], coords[0]);
        if (!geoCheck.valid) {
          issues.push({ severity: 'CRITICAL', collection: 'Hospitals_data', documentId: id, field: 'location.coordinates', issue: geoCheck.reason! });
        }
        if (typeof hospital.longitude === 'number' && typeof hospital.latitude === 'number') {
          if (Math.abs(coords[0] - hospital.longitude) > 0.0001 || Math.abs(coords[1] - hospital.latitude) > 0.0001) {
            issues.push({ severity: 'WARNING', collection: 'Hospitals_data', documentId: id, field: 'location', issue: `GeoJSON coordinates [${coords.join(', ')}] differ from lat/lng fields (${hospital.latitude}, ${hospital.longitude})` });
          }
        }
      }
    }
  }

  // 3. Audit Ambulance Providers
  issues.push(...findDuplicates(providers, 'email', 'Providers_Data'));
  issues.push(...findDuplicates(providers, 'registrationNumber', 'Providers_Data'));
  for (const provider of providers) {
    const id = String(provider._id);
    if (!provider.name?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'Providers_Data', documentId: id, field: 'name', issue: 'Missing required field "name"' });
    }
    if (!provider.registrationNumber?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'Providers_Data', documentId: id, field: 'registrationNumber', issue: 'Missing required field "registrationNumber"' });
    }
    if (!provider.email?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'Providers_Data', documentId: id, field: 'email', issue: 'Missing required field "email"' });
    } else if (!EMAIL_REGEX.test(provider.email)) {
      issues.push({ severity: 'WARNING', collection: 'Providers_Data', documentId: id, field: 'email', issue: `Invalid email format "${provider.email}"` });
    }
    if (provider.profileCompletionStatus === 'INCOMPLETE') {
      issues.push({ severity: 'READINESS', collection: 'Providers_Data', documentId: id, field: 'profileCompletionStatus', issue: 'Provider profile is incomplete' });
    }
  }

  // 4. Audit Ambulance Drivers
  issues.push(...findDuplicates(drivers, 'email', 'AmbulanceDriver'));
  issues.push(...findDuplicates(drivers, 'licenseNumber', 'AmbulanceDriver'));
  for (const driver of drivers) {
    const id = String(driver._id);
    if (!driver.fullName?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'AmbulanceDriver', documentId: id, field: 'fullName', issue: 'Missing required field "fullName"' });
    }
    if (!driver.licenseNumber?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'AmbulanceDriver', documentId: id, field: 'licenseNumber', issue: 'Missing required field "licenseNumber"' });
    }
    if (!driver.email?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'AmbulanceDriver', documentId: id, field: 'email', issue: 'Missing required field "email"' });
    } else if (!EMAIL_REGEX.test(driver.email)) {
      issues.push({ severity: 'WARNING', collection: 'AmbulanceDriver', documentId: id, field: 'email', issue: `Invalid email format "${driver.email}"` });
    }

    // Driver reference integrity: providerId
    if (!driver.providerId) {
      issues.push({ severity: 'CRITICAL', collection: 'AmbulanceDriver', documentId: id, field: 'providerId', issue: 'Driver missing providerId' });
    } else {
      const pId = String(driver.providerId);
      const prov = providerMap.get(pId);
      if (!prov) {
        issues.push({ severity: 'CRITICAL', collection: 'AmbulanceDriver', documentId: id, field: 'providerId', issue: `Driver references nonexistent provider "${pId}"` });
      } else {
        if (prov.accountStatus !== 'ACTIVE' || prov.verificationStatus !== 'VERIFIED') {
          issues.push({ severity: 'READINESS', collection: 'AmbulanceDriver', documentId: id, field: 'providerId', issue: `Driver linked to inactive or unverified provider (status: ${prov.accountStatus}, verification: ${prov.verificationStatus})` });
        }
      }
    }

    // Driver reference integrity: assignedAmbulanceId
    if (driver.assignedAmbulanceId) {
      const aId = String(driver.assignedAmbulanceId);
      const amb = ambulanceMap.get(aId);
      if (!amb) {
        issues.push({ severity: 'CRITICAL', collection: 'AmbulanceDriver', documentId: id, field: 'assignedAmbulanceId', issue: `Driver references nonexistent ambulance "${aId}"` });
      } else if (driver.providerId && String(amb.providerId) !== String(driver.providerId)) {
        issues.push({ severity: 'WARNING', collection: 'AmbulanceDriver', documentId: id, field: 'assignedAmbulanceId', issue: `Driver assigned ambulance belongs to provider "${amb.providerId}", but driver belongs to provider "${driver.providerId}"` });
      }
    }

    if (driver.profileCompletionStatus === 'INCOMPLETE') {
      issues.push({ severity: 'READINESS', collection: 'AmbulanceDriver', documentId: id, field: 'profileCompletionStatus', issue: 'Driver profile is incomplete' });
    }
  }

  // 5. Audit Ambulances
  issues.push(...findDuplicates(ambulances, 'registrationNumber', 'Ambulance_Data'));
  issues.push(...findDuplicates(ambulances, 'vehicleNumber', 'Ambulance_Data'));
  for (const amb of ambulances) {
    const id = String(amb._id);
    if (!amb.registrationNumber?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'Ambulance_Data', documentId: id, field: 'registrationNumber', issue: 'Missing required field "registrationNumber"' });
    }
    if (!amb.vehicleNumber?.trim()) {
      issues.push({ severity: 'CRITICAL', collection: 'Ambulance_Data', documentId: id, field: 'vehicleNumber', issue: 'Missing required field "vehicleNumber"' });
    }

    // Ambulance reference integrity: providerId
    if (!amb.providerId) {
      issues.push({ severity: 'CRITICAL', collection: 'Ambulance_Data', documentId: id, field: 'providerId', issue: 'Ambulance missing providerId' });
    } else {
      const pId = String(amb.providerId);
      if (!providerMap.has(pId)) {
        issues.push({ severity: 'CRITICAL', collection: 'Ambulance_Data', documentId: id, field: 'providerId', issue: `Ambulance references nonexistent provider "${pId}"` });
      }
    }

    const coordCheck = isValidCoordinate(amb.currentLatitude, amb.currentLongitude);
    if (!coordCheck.valid) {
      issues.push({ severity: 'CRITICAL', collection: 'Ambulance_Data', documentId: id, field: 'coordinates', issue: coordCheck.reason! });
    }

    if (amb.location) {
      if (amb.location.type !== 'Point') {
        issues.push({ severity: 'WARNING', collection: 'Ambulance_Data', documentId: id, field: 'location.type', issue: `GeoJSON type should be "Point", got "${amb.location.type}"` });
      }
      const coords = amb.location.coordinates;
      if (!Array.isArray(coords) || coords.length !== 2) {
        issues.push({ severity: 'CRITICAL', collection: 'Ambulance_Data', documentId: id, field: 'location.coordinates', issue: 'GeoJSON coordinates must be a 2-element array [lng, lat]' });
      } else {
        const geoCheck = isValidCoordinate(coords[1], coords[0]);
        if (!geoCheck.valid) {
          issues.push({ severity: 'CRITICAL', collection: 'Ambulance_Data', documentId: id, field: 'location.coordinates', issue: geoCheck.reason! });
        }
      }
    }
  }

  // 6. Audit Emergency Requests
  issues.push(...findDuplicates(emergencyRequests, 'requestCode', 'emergencyrequests'));
  for (const req of emergencyRequests) {
    const id = String(req._id);
    if (req.userId && !userMap.has(String(req.userId))) {
      issues.push({ severity: 'WARNING', collection: 'emergencyrequests', documentId: id, field: 'userId', issue: `EmergencyRequest references nonexistent user "${req.userId}"` });
    }
    if (req.hospitalId && !hospitalMap.has(String(req.hospitalId))) {
      issues.push({ severity: 'WARNING', collection: 'emergencyrequests', documentId: id, field: 'hospitalId', issue: `EmergencyRequest references nonexistent hospital "${req.hospitalId}"` });
    }
    if (req.ambulanceId && !ambulanceMap.has(String(req.ambulanceId))) {
      issues.push({ severity: 'WARNING', collection: 'emergencyrequests', documentId: id, field: 'ambulanceId', issue: `EmergencyRequest references nonexistent ambulance "${req.ambulanceId}"` });
    }
    if (req.driverId && !driverMap.has(String(req.driverId))) {
      issues.push({ severity: 'WARNING', collection: 'emergencyrequests', documentId: id, field: 'driverId', issue: `EmergencyRequest references nonexistent driver "${req.driverId}"` });
    }
  }

  // 7. Audit Trips
  issues.push(...findDuplicates(trips, 'emergencyRequestId', 'trips'));
  for (const trip of trips) {
    const id = String(trip._id);
    if (trip.emergencyRequestId && !emergencyMap.has(String(trip.emergencyRequestId))) {
      issues.push({ severity: 'CRITICAL', collection: 'trips', documentId: id, field: 'emergencyRequestId', issue: `Trip references nonexistent emergencyRequestId "${trip.emergencyRequestId}"` });
    }
    if (trip.providerId && !providerMap.has(String(trip.providerId))) {
      issues.push({ severity: 'CRITICAL', collection: 'trips', documentId: id, field: 'providerId', issue: `Trip references nonexistent providerId "${trip.providerId}"` });
    }
    if (trip.ambulanceId && !ambulanceMap.has(String(trip.ambulanceId))) {
      issues.push({ severity: 'CRITICAL', collection: 'trips', documentId: id, field: 'ambulanceId', issue: `Trip references nonexistent ambulanceId "${trip.ambulanceId}"` });
    }
    if (trip.destinationHospitalId && !hospitalMap.has(String(trip.destinationHospitalId))) {
      issues.push({ severity: 'CRITICAL', collection: 'trips', documentId: id, field: 'destinationHospitalId', issue: `Trip references nonexistent destinationHospitalId "${trip.destinationHospitalId}"` });
    }
  }

  // 8. Audit Hospital Patients
  issues.push(...findDuplicates(hospitalPatients, 'caseId', 'hospitalpatients'));
  issues.push(...findDuplicates(hospitalPatients, 'emergencyId', 'hospitalpatients'));

  const counts = {
    users: {
      total: users.length,
      byRole: countBy(users, 'role'),
      byAccountStatus: countBy(users, 'accountStatus'),
    },
    hospitals: {
      total: hospitals.length,
      byAccountStatus: countBy(hospitals, 'accountStatus'),
      byVerificationStatus: countBy(hospitals, 'verificationStatus'),
      byOperationalStatus: countBy(hospitals, 'emergencyAvailability'),
    },
    providers: {
      total: providers.length,
      byAccountStatus: countBy(providers, 'accountStatus'),
      byVerificationStatus: countBy(providers, 'verificationStatus'),
    },
    drivers: {
      total: drivers.length,
      byAccountStatus: countBy(drivers, 'accountStatus'),
      byVerificationStatus: countBy(drivers, 'licenseVerificationStatus'),
      byOperationalStatus: countBy(drivers, 'availabilityStatus'),
    },
    ambulances: {
      total: ambulances.length,
      byAccountStatus: countBy(ambulances, 'accountStatus'),
      byVerificationStatus: countBy(ambulances, 'verificationStatus'),
      byOperationalStatus: countBy(ambulances, 'currentStatus'),
    },
    emergencyRequests: {
      total: emergencyRequests.length,
      byOperationalStatus: countBy(emergencyRequests, 'status'),
    },
    trips: {
      total: trips.length,
      byOperationalStatus: countBy(trips, 'status'),
    },
    hospitalPatients: {
      total: hospitalPatients.length,
      byOperationalStatus: countBy(hospitalPatients, 'coordinationStatus'),
    },
  };

  const criticalIssues = issues.filter((i) => i.severity === 'CRITICAL').length;
  const warningIssues = issues.filter((i) => i.severity === 'WARNING').length;
  const readinessIssues = issues.filter((i) => i.severity === 'READINESS').length;
  const infoIssues = issues.filter((i) => i.severity === 'INFO').length;
  const totalDocuments =
    users.length +
    hospitals.length +
    providers.length +
    drivers.length +
    ambulances.length +
    emergencyRequests.length +
    trips.length +
    hospitalPatients.length;

  return {
    timestamp: new Date().toISOString(),
    databaseName: dbName,
    connected: true,
    counts,
    issues,
    summary: {
      totalDocuments,
      criticalIssues,
      warningIssues,
      readinessIssues,
      infoIssues,
    },
  };
};

const formatCountMap = (map?: Record<string, number>): string => {
  if (!map || Object.keys(map).length === 0) return 'none';
  return Object.entries(map)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
};

export const printReport = (report: AuditReport): void => {
  console.log('\n================================================================');
  console.log('             ResQ DATABASE INTEGRITY AUDIT REPORT               ');
  console.log('================================================================');
  console.log(`Timestamp     : ${report.timestamp}`);
  console.log(`Database      : ${report.databaseName}`);
  console.log(`Total Records : ${report.summary.totalDocuments}`);
  console.log('----------------------------------------------------------------\n');

  console.log('DOCUMENT COUNTS & STATUS BREAKDOWNS:');
  console.log(`  • Users               : ${report.counts.users.total}`);
  console.log(`      Roles             : ${formatCountMap(report.counts.users.byRole)}`);
  console.log(`      Account Status    : ${formatCountMap(report.counts.users.byAccountStatus)}`);

  console.log(`  • Hospitals           : ${report.counts.hospitals.total}`);
  console.log(`      Verification      : ${formatCountMap(report.counts.hospitals.byVerificationStatus)}`);
  console.log(`      Account Status    : ${formatCountMap(report.counts.hospitals.byAccountStatus)}`);
  console.log(`      Emergency Status  : ${formatCountMap(report.counts.hospitals.byOperationalStatus)}`);

  console.log(`  • Ambulance Providers : ${report.counts.providers.total}`);
  console.log(`      Verification      : ${formatCountMap(report.counts.providers.byVerificationStatus)}`);
  console.log(`      Account Status    : ${formatCountMap(report.counts.providers.byAccountStatus)}`);

  console.log(`  • Ambulance Drivers   : ${report.counts.drivers.total}`);
  console.log(`      Verification      : ${formatCountMap(report.counts.drivers.byVerificationStatus)}`);
  console.log(`      Account Status    : ${formatCountMap(report.counts.drivers.byAccountStatus)}`);
  console.log(`      Availability      : ${formatCountMap(report.counts.drivers.byOperationalStatus)}`);

  console.log(`  • Ambulances          : ${report.counts.ambulances.total}`);
  console.log(`      Verification      : ${formatCountMap(report.counts.ambulances.byVerificationStatus)}`);
  console.log(`      Account Status    : ${formatCountMap(report.counts.ambulances.byAccountStatus)}`);
  console.log(`      Current Status    : ${formatCountMap(report.counts.ambulances.byOperationalStatus)}`);

  console.log(`  • Emergency Requests  : ${report.counts.emergencyRequests.total}`);
  console.log(`      Statuses          : ${formatCountMap(report.counts.emergencyRequests.byOperationalStatus)}`);

  console.log(`  • Trips               : ${report.counts.trips.total}`);
  console.log(`      Statuses          : ${formatCountMap(report.counts.trips.byOperationalStatus)}`);

  console.log(`  • Hospital Patients   : ${report.counts.hospitalPatients.total}`);
  console.log(`      Coordination      : ${formatCountMap(report.counts.hospitalPatients.byOperationalStatus)}`);

  console.log('\n----------------------------------------------------------------');
  console.log('AUDIT ANOMALIES & INTEGRITY FINDINGS:');
  console.log(`  Critical: ${report.summary.criticalIssues} | Warning: ${report.summary.warningIssues} | Readiness: ${report.summary.readinessIssues} | Info: ${report.summary.infoIssues}`);
  console.log('----------------------------------------------------------------');

  if (report.issues.length === 0) {
    console.log('  No integrity issues or anomalies detected. Database is clean!');
  } else {
    for (const issue of report.issues) {
      const tag =
        issue.severity === 'CRITICAL'
          ? '[CRITICAL]'
          : issue.severity === 'WARNING'
            ? '[WARNING]'
            : issue.severity === 'READINESS'
              ? '[READINESS]'
              : '[INFO]';
      const doc = issue.documentId ? ` (Doc: ${issue.documentId})` : '';
      const field = issue.field ? ` [Field: ${issue.field}]` : '';
      console.log(`  ${tag} ${issue.collection}${doc}${field}: ${issue.issue}`);
    }
  }

  console.log('\n================================================================\n');
};

const execute = async (): Promise<void> => {
  const isJson = process.argv.includes('--json');
  const isStrict = process.argv.includes('--strict');
  const sanitizedUri = sanitizeMongoUri(env.MONGODB_URI);

  if (!isJson) {
    console.log(`Connecting to database (${sanitizedUri})...`);
  }

  try {
    await connectDatabase();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? sanitizeMongoUri(err.message) : 'Unknown connection error';
    if (isJson) {
      console.error(JSON.stringify({ error: 'DATABASE_CONNECTION_ERROR', details: errorMsg }));
    } else {
      console.error('\n[DATABASE CONNECTION ERROR]');
      console.error(`Could not connect to MongoDB at: ${sanitizedUri}`);
      console.error(`Details: ${errorMsg}\n`);
      console.error('TROUBLESHOOTING GUIDE:');
      console.error('1. MongoDB Atlas: Check if your IP address is whitelisted in Atlas Network Access.');
      console.error('2. Special Characters: Ensure username and password in MONGODB_URI are URL-encoded.');
      console.error('3. Local MongoDB: Verify that your local mongod service is running (e.g. `brew services start mongodb-community`).');
      console.error('4. Firewall/Sandbox: Verify network access is permitted to the database host.\n');
    }
    process.exitCode = 1;
    return;
  }

  try {
    const report = await runDatabaseAudit();
    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }

    if (report.summary.criticalIssues > 0) {
      if (!isJson) console.warn(`Audit completed with ${report.summary.criticalIssues} critical data integrity issue(s).`);
      process.exitCode = 1;
    } else if (isStrict && report.summary.warningIssues > 0) {
      if (!isJson) console.warn(`Audit strict check failed: ${report.summary.warningIssues} warning issue(s) detected.`);
      process.exitCode = 1;
    } else {
      if (!isJson) console.info('Audit completed successfully. Data integrity validated.');
    }
  } catch (auditError: unknown) {
    const errorMsg = auditError instanceof Error ? sanitizeMongoUri(auditError.message) : 'Unknown audit error';
    if (isJson) {
      console.error(JSON.stringify({ error: 'AUDIT_EXECUTION_ERROR', details: errorMsg }));
    } else {
      console.error(`Audit failed during execution: ${errorMsg}`);
    }
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
};

const isMainModule = (): boolean => {
  if (!process.argv[1]) return false;
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    return path.resolve(process.argv[1]) === path.resolve(currentFilePath);
  } catch {
    return false;
  }
};

// Auto-run only if executed directly via CLI
if (isMainModule()) {
  void execute();
}
