import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const baseUrl = process.env.TEST_BASE_URL;
const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1' && Boolean(baseUrl);

interface ApiResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

const request = async (path: string, init?: RequestInit): Promise<{ response: Response; body: ApiResponse }> => {
  if (!baseUrl) throw new Error('TEST_BASE_URL is required');
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json() as ApiResponse;
  return { response, body };
};

const cookieHeader = (response: Response): string => response.headers.getSetCookie().map((cookie) => cookie.split(';', 1)[0]).join('; ');

describe('authentication integration', { skip: !runIntegration }, () => {
  let userEmail = '';
  let userCookies = '';
  const userPassword = 'StrongPassword123!';

  before(() => {
    userEmail = `integration-${randomUUID()}@example.com`;
  });

  it('registers a user successfully', async () => {
    const { response, body } = await request('/api/v1/auth/register/user', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Integration User', email: userEmail, phone: `9${Date.now().toString().slice(-9)}`, password: userPassword }),
    });

    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(typeof body.data?.id, 'string');
  });

  it('rejects duplicate user email', async () => {
    const { response, body } = await request('/api/v1/auth/register/user', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Integration User 2', email: userEmail, phone: `8${Date.now().toString().slice(-9)}`, password: userPassword }),
    });

    assert.equal(response.status, 409);
    assert.equal(body.error?.code, 'EMAIL_ALREADY_EXISTS');
  });

  it('logs in with the registered user', async () => {
    const { response, body } = await request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: userPassword }),
    });

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data?.user && typeof body.data.user === 'object', true);
    userCookies = cookieHeader(response);
    assert.match(userCookies, /resq_access_token=/);
    assert.match(userCookies, /resq_refresh_token=/);
  });

  it('rejects an incorrect password', async () => {
    const { response, body } = await request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'WrongPassword123!' }),
    });

    assert.equal(response.status, 401);
    assert.equal(body.error?.code, 'INVALID_CREDENTIALS');
  });

  it('returns the authenticated user from /me', async () => {
    const { response, body } = await request('/api/v1/auth/me', { headers: { cookie: userCookies } });
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data?.role, 'USER');
    assert.equal(body.data?.accountStatus, 'ACTIVE');
    assert.equal('passwordHash' in (body.data ?? {}), false);
  });

  it('rejects an invalid access token', async () => {
    const { response, body } = await request('/api/v1/auth/me', { headers: { authorization: 'Bearer invalid-token' } });
    assert.equal(response.status, 401);
    assert.equal(body.error?.code, 'INVALID_TOKEN');
  });

  it('rejects an unauthenticated /me request', async () => {
    const { response, body } = await request('/api/v1/auth/me');
    assert.equal(response.status, 401);
    assert.equal(body.error?.code, 'UNAUTHORIZED');
  });

  it('logs out and invalidates the refresh session', async () => {
    const { response, body } = await request('/api/v1/auth/logout', { method: 'POST', headers: { cookie: userCookies } });
    assert.equal(response.status, 200);
    assert.equal(body.data?.loggedOut, true);

    const refreshResponse = await request('/api/v1/auth/refresh', { method: 'POST', headers: { cookie: userCookies } });
    assert.equal(refreshResponse.response.status, 401);
    assert.equal(refreshResponse.body.error?.code, 'INVALID_TOKEN');
  });

  it('registers a hospital as pending', async () => {
    const email = `hospital-${randomUUID()}@example.com`;
    const { response, body } = await request('/api/v1/auth/register/hospital', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Integration Hospital', email, phone: `7${Date.now().toString().slice(-9)}`, password: userPassword, registrationNumber: `H-${randomUUID()}`, hospitalType: 'General' }),
    });

    assert.equal(response.status, 201);
    assert.equal(body.data?.role, 'HOSPITAL');
    assert.equal(body.data?.accountStatus, 'PENDING');
  });

  it('registers an ambulance provider as pending', async () => {
    const { response, body } = await request('/api/v1/auth/register/ambulance-provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Integration Provider', email: `provider-${randomUUID()}@example.com`, phone: `6${Date.now().toString().slice(-9)}`, password: userPassword, registrationNumber: `P-${randomUUID()}`, serviceType: 'Emergency' }),
    });

    assert.equal(response.status, 201);
    assert.equal(body.data?.role, 'AMBULANCE_PROVIDER');
    assert.equal(body.data?.accountStatus, 'PENDING');
  });

  it('supports ambulance driver registration when TEST_PROVIDER_ID is supplied', async () => {
    if (!process.env.TEST_PROVIDER_ID) return;

    const { response, body } = await request('/api/v1/auth/register/ambulance-driver', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fullName: 'Integration Driver', email: `driver-${randomUUID()}@example.com`, phone: `5${Date.now().toString().slice(-9)}`, password: userPassword, licenseNumber: `L-${randomUUID()}`, providerId: process.env.TEST_PROVIDER_ID }),
    });

    assert.equal(response.status, 201);
    assert.equal(body.data?.role, 'AMBULANCE_DRIVER');
    assert.equal(body.data?.accountStatus, 'PENDING');
  });

  it('tests configured admin login when RUN_ADMIN_TESTS is enabled', async () => {
    if (process.env.RUN_ADMIN_TESTS !== '1') return;
    assert.ok(process.env.RESQ_ADMIN_EMAIL);
    assert.ok(process.env.RESQ_ADMIN_PASSWORD);

    const { response, body } = await request('/api/v1/auth/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: process.env.RESQ_ADMIN_EMAIL, password: process.env.RESQ_ADMIN_PASSWORD }),
    });

    assert.equal(response.status, 200);
    assert.equal(body.data?.user && typeof body.data.user === 'object', true);
    const cookies = cookieHeader(response);
    const me = await request('/api/v1/auth/me', { headers: { cookie: cookies } });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.data?.role, 'ADMIN');
  });
});
