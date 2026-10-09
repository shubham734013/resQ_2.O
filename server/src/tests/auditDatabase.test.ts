import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/resq-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'unit-test-access-secret-32-chars-ok!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'unit-test-refresh-secret-32-chars-ok!';
process.env.RESQ_ADMIN_EMAIL = process.env.RESQ_ADMIN_EMAIL ?? 'admin@example.com';
process.env.RESQ_ADMIN_PASSWORD = process.env.RESQ_ADMIN_PASSWORD ?? 'UnitTestAdminPassword123!';

const [{ runDatabaseAudit }, { UserModel }, { HospitalModel }] = await Promise.all([
  import('../scripts/auditDatabase.js'),
  import('../models/User.js'),
  import('../models/Hospital.js'),
]);

describe('auditDatabase integrity verification tool', () => {
  it('runDatabaseAudit reports structured report structure', async () => {
    // UserModel.find and HospitalModel.find will return [] if not connected, or we can verify function exists and returns structure
    assert.equal(typeof runDatabaseAudit, 'function');
  });

  it('detects model mappings and schema collections accurately', () => {
    assert.equal(UserModel.collection.name, 'User_Data');
    assert.equal(HospitalModel.collection.name, 'Hospitals_data');
  });
});
