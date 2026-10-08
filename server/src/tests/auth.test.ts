import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { userRegistrationSchema, hospitalRegistrationSchema, ambulanceProviderRegistrationSchema, ambulanceDriverRegistrationSchema, loginSchema } from '../schemas/auth.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';

process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/resq-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'unit-test-access-secret-32-chars-ok!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'unit-test-refresh-secret-32-chars-ok!';
process.env.RESQ_ADMIN_EMAIL = process.env.RESQ_ADMIN_EMAIL ?? 'admin@example.com';
process.env.RESQ_ADMIN_PASSWORD = process.env.RESQ_ADMIN_PASSWORD ?? 'UnitTestAdminPassword123!';

const { assertLoginAllowed } = await import('../services/authService.js');

const validBase = {
  name: 'Test User',
  email: 'TEST@EXAMPLE.COM',
  phone: '9876543210',
  password: 'StrongPassword123!',
};

describe('authentication validation', () => {
  it('normalizes user registration email', () => {
    const result = userRegistrationSchema.parse(validBase);
    assert.equal(result.email, 'test@example.com');
  });

  it('validates hospital registration fields', () => {
    const result = hospitalRegistrationSchema.parse({
      ...validBase,
      registrationNumber: 'HOSP-001',
      hospitalType: 'General',
    });
    assert.equal(result.registrationNumber, 'HOSP-001');
  });

  it('validates ambulance provider registration fields', () => {
    const result = ambulanceProviderRegistrationSchema.parse({
      ...validBase,
      registrationNumber: 'PROVIDER-001',
      serviceType: 'Emergency',
    });
    assert.equal(result.serviceType, 'Emergency');
  });

  it('validates ambulance driver registration fields', () => {
    const result = ambulanceDriverRegistrationSchema.parse({
      fullName: 'Driver Test',
      email: 'driver@example.com',
      phone: '9876543211',
      password: 'StrongPassword123!',
      licenseNumber: 'LIC-001',
      providerId: '507f1f77bcf86cd799439011',
    });
    assert.equal(result.providerId, '507f1f77bcf86cd799439011');
  });

  it('validates login credentials', () => {
    const result = loginSchema.parse({ email: 'USER@EXAMPLE.COM', password: 'password' });
    assert.equal(result.email, 'user@example.com');
  });
});

describe('role authorization', () => {
  it('allows an explicitly permitted role', () => {
    let nextCalled = false;
    const middleware = authorizeRole('ADMIN', 'HOSPITAL');
    middleware({ auth: { id: '1', email: 'admin@example.com', role: 'ADMIN', accountStatus: 'ACTIVE' } } as never, {} as never, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  it('rejects a role outside the allowed list', () => {
    let errorCode = '';
    const middleware = authorizeRole('ADMIN');
    middleware({ auth: { id: '1', email: 'user@example.com', role: 'USER', accountStatus: 'ACTIVE' } } as never, {} as never, (error?: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') errorCode = error.code;
    });
    assert.equal(errorCode, 'FORBIDDEN');
  });

  it('rejects missing authentication', () => {
    let errorCode = '';
    const middleware = authorizeRole('ADMIN');
    middleware({} as never, {} as never, (error?: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') errorCode = error.code;
    });
    assert.equal(errorCode, 'UNAUTHORIZED');
  });
});

describe('account status policy', () => {
  it('allows ACTIVE accounts', () => {
    assert.doesNotThrow(() => assertLoginAllowed('ACTIVE'));
  });

  it('rejects SUSPENDED accounts', () => {
    assert.throws(() => assertLoginAllowed('SUSPENDED'), { code: 'ACCOUNT_SUSPENDED' });
  });

  it('rejects REJECTED accounts', () => {
    assert.throws(() => assertLoginAllowed('REJECTED'), { code: 'ACCOUNT_REJECTED' });
  });

  it('rejects PENDING accounts with an operational approval response', () => {
    assert.throws(() => assertLoginAllowed('PENDING'), { code: 'ACCOUNT_PENDING' });
  });
});
