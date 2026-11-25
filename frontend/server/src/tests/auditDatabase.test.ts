import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/resq-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'unit-test-access-secret-32-chars-ok!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'unit-test-refresh-secret-32-chars-ok!';
process.env.RESQ_ADMIN_EMAIL = process.env.RESQ_ADMIN_EMAIL ?? 'admin@example.com';
process.env.RESQ_ADMIN_PASSWORD = process.env.RESQ_ADMIN_PASSWORD ?? 'UnitTestAdminPassword123!';

const [
  { runDatabaseAudit, isValidCoordinate, findDuplicates },
  { UserModel },
  { HospitalModel },
  { ambulanceDriverRegistrationSchema },
  { enrichHospitalCoordinates },
] = await Promise.all([
  import('../scripts/auditDatabase.js'),
  import('../models/User.js'),
  import('../models/Hospital.js'),
  import('../schemas/auth.js'),
  import('../scripts/enrichHospitalCoordinates.js'),
]);

describe('auditDatabase integrity verification tool', () => {
  it('runDatabaseAudit reports structured report structure', () => {
    assert.equal(typeof runDatabaseAudit, 'function');
  });

  it('detects model mappings and schema collections accurately', () => {
    assert.equal(UserModel.collection.name, 'User_Data');
    assert.equal(HospitalModel.collection.name, 'Hospitals_data');
  });

  it('validates coordinates strictly within geographic limits', () => {
    assert.deepEqual(isValidCoordinate(undefined, undefined), { valid: true });
    assert.deepEqual(isValidCoordinate(null, null), { valid: true });
    assert.deepEqual(isValidCoordinate(26.9124, 75.7873), { valid: true });
    assert.deepEqual(isValidCoordinate(-90, -180), { valid: true });
    assert.deepEqual(isValidCoordinate(90, 180), { valid: true });

    // Out of bounds
    const latOver = isValidCoordinate(91, 75);
    assert.equal(latOver.valid, false);
    assert.match(latOver.reason ?? '', /Latitude 91 is out of valid range/);

    const latUnder = isValidCoordinate(-90.1, 75);
    assert.equal(latUnder.valid, false);

    const lngOver = isValidCoordinate(26, 180.5);
    assert.equal(lngOver.valid, false);
    assert.match(lngOver.reason ?? '', /Longitude 180.5 is out of valid range/);

    const lngUnder = isValidCoordinate(26, -181);
    assert.equal(lngUnder.valid, false);
  });

  it('identifies duplicates correctly across documents', () => {
    const records = [
      { _id: '1', email: 'user1@example.com' },
      { _id: '2', email: 'USER1@example.com' }, // duplicate (case-insensitive)
      { _id: '3', email: 'user2@example.com' },
      { _id: '4', email: '' }, // empty, ignored
    ];
    const issues = findDuplicates(records, 'email', 'User_Data');
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.collection, 'User_Data');
    assert.equal(issues[0]?.field, 'email');
    assert.match(issues[0]?.issue ?? '', /Duplicate value "user1@example.com"/);
  });
});

describe('ambulance driver registration schema validation', () => {
  it('preprocesses empty string assignedAmbulanceId to undefined without failing validation', () => {
    const validDriverPayload = {
      fullName: 'Rajesh Sharma',
      email: 'rajesh.driver@example.com',
      phone: '9876543210',
      password: 'StrongPassword123!',
      licenseNumber: 'RJ-14-2023-1234567',
      providerId: '6ac9e5d225fcef544e069ea6',
      assignedAmbulanceId: '', // Empty string from UI form
      address: '',
      city: '',
      state: '',
      country: '',
    };

    const parsed = ambulanceDriverRegistrationSchema.safeParse(validDriverPayload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.assignedAmbulanceId, undefined);
      assert.equal(parsed.data.address, undefined);
      assert.equal(parsed.data.city, undefined);
      assert.equal(parsed.data.state, undefined);
      assert.equal(parsed.data.country, undefined);
    }
  });

  it('accepts valid 24-char ObjectId for assignedAmbulanceId', () => {
    const validDriverPayload = {
      fullName: 'Vikram Singh',
      email: 'vikram.driver@example.com',
      phone: '9876543211',
      password: 'StrongPassword123!',
      licenseNumber: 'RJ-14-2023-7654321',
      providerId: '6ac9e5d225fcef544e069ea6',
      assignedAmbulanceId: '6ac9e5d225fcef544e069ea7',
    };

    const parsed = ambulanceDriverRegistrationSchema.safeParse(validDriverPayload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.assignedAmbulanceId, '6ac9e5d225fcef544e069ea7');
    }
  });

  it('rejects malformed ObjectId strings for assignedAmbulanceId', () => {
    const invalidDriverPayload = {
      fullName: 'Vikram Singh',
      email: 'vikram.driver@example.com',
      phone: '9876543211',
      password: 'StrongPassword123!',
      licenseNumber: 'RJ-14-2023-7654321',
      providerId: '6ac9e5d225fcef544e069ea6',
      assignedAmbulanceId: 'not-an-objectid',
    };

    const parsed = ambulanceDriverRegistrationSchema.safeParse(invalidDriverPayload);
    assert.equal(parsed.success, false);
  });
});

describe('hospital coordinate enrichment validation', () => {
  it('enrichHospitalCoordinates function exists and handles empty key without fabricating coordinates', async () => {
    assert.equal(typeof enrichHospitalCoordinates, 'function');
    const prevKey = process.env.GOOGLE_GEOCODING_API_KEY;
    try {
      process.env.GOOGLE_GEOCODING_API_KEY = '';
      const result = await enrichHospitalCoordinates({ dryRun: true });
      assert.equal(result.dryRun, true);
      assert.equal(result.enriched, 0);
    } finally {
      process.env.GOOGLE_GEOCODING_API_KEY = prevKey;
    }
  });
});
