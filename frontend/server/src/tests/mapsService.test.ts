import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/resq-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'unit-test-access-secret-32-chars-ok!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'unit-test-refresh-secret-32-chars-ok!';
process.env.RESQ_ADMIN_EMAIL = process.env.RESQ_ADMIN_EMAIL ?? 'admin@example.com';
process.env.RESQ_ADMIN_PASSWORD = process.env.RESQ_ADMIN_PASSWORD ?? 'UnitTestAdminPassword123!';

const { describeGoogleRoutesFailure } = await import('../services/mapsService.js');

describe('Google Routes API failure mapping', () => {
  it('explains key, API enablement, or billing configuration failures without exposing provider details', () => {
    const result = describeGoogleRoutesFailure(403, {
      error: { status: 'PERMISSION_DENIED', message: 'private provider response', details: [{ reason: 'SERVICE_DISABLED' }] },
    });
    assert.equal(result.code, 'ROUTES_API_CONFIGURATION_ERROR');
    assert.equal(result.statusCode, 502);
    assert.match(result.message, /Routes API is enabled/);
    assert.ok(!result.message.includes('private provider response'));
  });

  it('returns a retryable quota message for rate limits', () => {
    const result = describeGoogleRoutesFailure(429, { error: { status: 'RESOURCE_EXHAUSTED' } });
    assert.equal(result.code, 'ROUTES_API_QUOTA_EXCEEDED');
    assert.equal(result.statusCode, 503);
    assert.match(result.message, /quota or rate limit/);
  });

  it('identifies invalid route input separately', () => {
    const result = describeGoogleRoutesFailure(400, { error: { status: 'INVALID_ARGUMENT' } });
    assert.equal(result.code, 'ROUTES_API_INVALID_REQUEST');
    assert.equal(result.statusCode, 400);
    assert.match(result.message, /coordinates/);
  });

  it('uses a safe generic fallback for unknown provider failures', () => {
    const result = describeGoogleRoutesFailure(500, null);
    assert.equal(result.code, 'ROUTE_PROVIDER_UNAVAILABLE');
    assert.equal(result.statusCode, 502);
    assert.doesNotMatch(result.message, /key=|AIza|private provider response/i);
  });
});
