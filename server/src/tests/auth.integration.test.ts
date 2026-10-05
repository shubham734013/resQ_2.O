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

describe('authentication integration', { skip: !runIntegration }, () => {
  let userEmail = '';
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
    assert.match(response.headers.get('set-cookie') ?? '', /resq_access_token=/);
    assert.match(response.headers.get('set-cookie') ?? '', /resq_refresh_token=/);
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

  it('rejects unauthenticated /me', async () => {
    const { response, body } = await request('/api/v1/auth/me');
    assert.equal(response.status, 401);
    assert.equal(body.error?.code, 'UNAUTHORIZED');
  });

  it('requires the configured admin seed for admin tests', () => {
    if (process.env.RUN_ADMIN_TESTS === '1') {
      assert.ok(process.env.RESQ_ADMIN_EMAIL);
      assert.ok(process.env.RESQ_ADMIN_PASSWORD);
    }
  });
});
