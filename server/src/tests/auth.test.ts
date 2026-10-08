import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { userRegistrationSchema, hospitalRegistrationSchema, ambulanceProviderRegistrationSchema, ambulanceDriverRegistrationSchema, loginSchema, socialAuthSchema } from '../schemas/auth.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { verifySocialCredential, setSocialCredentialVerifierForTest, resetSocialCredentialVerifierForTest } from '../providers/socialIdentity.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import { getCookie, setAuthCookies, clearAuthCookies, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../utils/cookies.js';
import bcrypt from 'bcrypt';

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

describe('social authentication validation', () => {
  it('validates a valid social credential payload', () => {
    const parsed = socialAuthSchema.parse({ credential: 'mock-google-id-token-with-sufficient-length', roleHint: 'USER' });
    assert.equal(parsed.roleHint, 'USER');
    assert.equal(parsed.credential, 'mock-google-id-token-with-sufficient-length');
  });

  it('rejects short credentials', () => {
    assert.throws(() => socialAuthSchema.parse({ credential: 'too-short' }));
  });

  it('allows ambulance provider roleHint', () => {
    const parsed = socialAuthSchema.parse({ credential: 'mock-microsoft-id-token-sufficient-length', roleHint: 'AMBULANCE_PROVIDER' });
    assert.equal(parsed.roleHint, 'AMBULANCE_PROVIDER');
  });
});

describe('social credential verification provider hook', () => {
  it('verifies Google credentials via provider hook', async () => {
    setSocialCredentialVerifierForTest(async (provider, credential) => {
      assert.equal(provider, 'GOOGLE');
      assert.equal(credential, 'test-google-token');
      return {
        provider: 'GOOGLE',
        providerSubject: 'g-sub-12345',
        email: 'google.user@example.com',
        name: 'Google User',
        emailVerified: true,
      };
    });

    const result = await verifySocialCredential('GOOGLE', 'test-google-token');
    assert.equal(result.provider, 'GOOGLE');
    assert.equal(result.email, 'google.user@example.com');
    assert.equal(result.emailVerified, true);
    resetSocialCredentialVerifierForTest();
  });

  it('verifies Microsoft credentials via provider hook', async () => {
    setSocialCredentialVerifierForTest(async (provider, credential) => {
      assert.equal(provider, 'MICROSOFT');
      assert.equal(credential, 'test-ms-token');
      return {
        provider: 'MICROSOFT',
        providerSubject: 'ms-oid-67890',
        email: 'ms.user@example.com',
        name: 'Microsoft User',
        emailVerified: true,
      };
    });

    const result = await verifySocialCredential('MICROSOFT', 'test-ms-token');
    assert.equal(result.provider, 'MICROSOFT');
    assert.equal(result.email, 'ms.user@example.com');
    assert.equal(result.emailVerified, true);
    resetSocialCredentialVerifierForTest();
  });
});

describe('database duplicate key error handling', () => {
  const createMockRes = () => {
    const res: { statusCode: number; jsonBody: Record<string, unknown>; status: (code: number) => typeof res; json: (body: unknown) => typeof res } = {
      statusCode: 200,
      jsonBody: {},
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.jsonBody = body as Record<string, unknown>; return this; },
    };
    return res;
  };

  it('maps email duplicate key error to EMAIL_ALREADY_EXISTS', () => {
    const res = createMockRes();
    const error = { code: 11000, keyPattern: { email: 1 } };
    errorHandler(error, { method: 'POST', path: '/auth/register' } as never, res as never, () => {});
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.jsonBody, {
      success: false,
      error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' },
    });
  });

  it('maps phone duplicate key error to PHONE_ALREADY_EXISTS', () => {
    const res = createMockRes();
    const error = { code: 11000, keyPattern: { phone: 1 } };
    errorHandler(error, { method: 'POST', path: '/auth/register' } as never, res as never, () => {});
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.jsonBody, {
      success: false,
      error: { code: 'PHONE_ALREADY_EXISTS', message: 'An account with this phone number already exists' },
    });
  });

  it('maps registrationNumber duplicate key error to REGISTRATION_NUMBER_ALREADY_EXISTS', () => {
    const res = createMockRes();
    const error = { code: 11000, keyPattern: { registrationNumber: 1 } };
    errorHandler(error, { method: 'POST', path: '/auth/register/hospital' } as never, res as never, () => {});
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.jsonBody, {
      success: false,
      error: { code: 'REGISTRATION_NUMBER_ALREADY_EXISTS', message: 'Registration number is already in use' },
    });
  });

  it('maps licenseNumber duplicate key error to LICENSE_NUMBER_ALREADY_EXISTS', () => {
    const res = createMockRes();
    const error = { code: 11000, keyPattern: { licenseNumber: 1 } };
    errorHandler(error, { method: 'POST', path: '/auth/register/driver' } as never, res as never, () => {});
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.jsonBody, {
      success: false,
      error: { code: 'LICENSE_NUMBER_ALREADY_EXISTS', message: 'License number is already in use' },
    });
  });
});

describe('cookie session utilities', () => {
  it('extracts cookies from header', () => {
    const req = { headers: { cookie: `${ACCESS_TOKEN_COOKIE}=test-access; ${REFRESH_TOKEN_COOKIE}=test-refresh` } };
    assert.equal(getCookie(req as never, ACCESS_TOKEN_COOKIE), 'test-access');
    assert.equal(getCookie(req as never, REFRESH_TOKEN_COOKIE), 'test-refresh');
    assert.equal(getCookie(req as never, 'non_existent'), undefined);
  });

  it('sets and clears authentication cookies', () => {
    const cookiesSet: Record<string, unknown> = {};
    const cookiesCleared: string[] = [];
    const res = {
      cookie(name: string, value: string, options: unknown) { cookiesSet[name] = { value, options }; },
      clearCookie(name: string) { cookiesCleared.push(name); },
    };
    setAuthCookies(res as never, 'token-a', 'token-r');
    assert.equal(ACCESS_TOKEN_COOKIE in cookiesSet, true);
    assert.equal(REFRESH_TOKEN_COOKIE in cookiesSet, true);

    clearAuthCookies(res as never);
    assert.equal(cookiesCleared.includes(ACCESS_TOKEN_COOKIE), true);
    assert.equal(cookiesCleared.includes(REFRESH_TOKEN_COOKIE), true);
  });
});

describe('password hashing and verification', () => {
  it('hashes and verifies passwords securely using bcrypt', async () => {
    const raw = 'SecureSecretPassword123!';
    const hashed = await bcrypt.hash(raw, 10);
    assert.notEqual(raw, hashed);
    assert.equal(await bcrypt.compare(raw, hashed), true);
    assert.equal(await bcrypt.compare('WrongSecretPassword!', hashed), false);
  });
});
