import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ambulanceListQuerySchema, driverListQuerySchema, hospitalListQuerySchema, providerListQuerySchema, userListQuerySchema } from '../schemas/admin.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';

const adminRequest = { auth: { id: 'admin-id', email: 'admin@example.com', role: 'ADMIN', accountStatus: 'ACTIVE' } };
const userRequest = { auth: { id: 'user-id', email: 'user@example.com', role: 'USER', accountStatus: 'ACTIVE' } };

describe('admin query validation', () => {
  it('applies safe pagination defaults and caps the limit', () => {
    const result = userListQuerySchema.parse({});
    assert.equal(result.page, 1);
    assert.equal(result.limit, 20);
    assert.throws(() => userListQuerySchema.parse({ limit: 101 }));
  });

  it('validates user filters and date ranges', () => {
    const result = userListQuerySchema.parse({ search: 'alice', role: 'USER', status: 'ACTIVE', city: 'Jaipur', from: '2026-01-01', to: '2026-02-01' });
    assert.equal(result.role, 'USER');
    assert.throws(() => userListQuerySchema.parse({ from: '2026-03-01', to: '2026-02-01' }));
  });

  it('rejects unsupported hospital/provider filters', () => {
    assert.throws(() => hospitalListQuerySchema.parse({ accountStatus: 'ACTIVE' }));
    assert.throws(() => providerListQuerySchema.parse({ mongo: '$where' }));
  });

  it('accepts validated provider and availability filters', () => {
    assert.equal(ambulanceListQuerySchema.parse({ provider: '507f1f77bcf86cd799439011' }).provider, '507f1f77bcf86cd799439011');
    assert.equal(driverListQuerySchema.parse({ provider: '507f1f77bcf86cd799439011' }).provider, '507f1f77bcf86cd799439011');
  });
});

describe('admin authorization contract', () => {
  it('allows ADMIN', () => {
    let called = false;
    authorizeRole('ADMIN')(adminRequest as never, {} as never, () => { called = true; });
    assert.equal(called, true);
  });

  for (const role of ['USER', 'HOSPITAL', 'AMBULANCE_PROVIDER', 'AMBULANCE_DRIVER'] as const) {
    it(`rejects ${role}`, () => {
      let code = '';
      authorizeRole('ADMIN')({ auth: { ...userRequest.auth, role } } as never, {} as never, (error?: unknown) => {
        if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') code = error.code;
      });
      assert.equal(code, 'FORBIDDEN');
    });
  }
});
