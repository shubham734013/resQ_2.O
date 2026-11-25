import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import type { Request, Response } from 'express';

process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/resq-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'unit-test-access-secret-32-chars-ok!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'unit-test-refresh-secret-32-chars-ok!';
process.env.RESQ_ADMIN_EMAIL = process.env.RESQ_ADMIN_EMAIL ?? 'admin@example.com';
process.env.RESQ_ADMIN_PASSWORD = process.env.RESQ_ADMIN_PASSWORD ?? 'UnitTestAdminPassword123!';

const [
  { sanitizeMongoUri, checkDatabaseHealth },
  { healthController },
  { errorHandler },
] = await Promise.all([
  import('../config/database.js'),
  import('../controllers/healthController.js'),
  import('../middlewares/errorHandler.js'),
]);

const createMockResponse = () => {
  const state = {
    statusCode: 200,
    body: null as unknown,
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
      return res;
    },
  } as unknown as Response;

  return { res, state };
};

describe('database URI sanitization', () => {
  it('masks standard mongodb URI credentials', () => {
    const raw = 'mongodb://appUser:SuperSecret123@cluster0.example.com:27017/resq_db?authSource=admin';
    const sanitized = sanitizeMongoUri(raw);
    assert.equal(sanitized, 'mongodb://appUser:*****@cluster0.example.com:27017/resq_db?authSource=admin');
    assert.ok(!sanitized.includes('SuperSecret123'));
  });

  it('masks mongodb+srv Atlas URI credentials', () => {
    const raw = 'mongodb+srv://atlasAdmin:P%40ssw0rd!@cluster0.drh5kyt.mongodb.net/resq?retryWrites=true&w=majority';
    const sanitized = sanitizeMongoUri(raw);
    assert.equal(sanitized, 'mongodb+srv://atlasAdmin:*****@cluster0.drh5kyt.mongodb.net/resq?retryWrites=true&w=majority');
    assert.ok(!sanitized.includes('P%40ssw0rd!'));
  });

  it('leaves URIs without credentials unchanged', () => {
    const raw = 'mongodb://127.0.0.1:27017/resq';
    assert.equal(sanitizeMongoUri(raw), 'mongodb://127.0.0.1:27017/resq');
  });
});

describe('database health verification and controller', () => {
  it('reports database health report when connection is not ready', async () => {
    const report = await checkDatabaseHealth();
    assert.ok(['CONNECTED', 'CONNECTING', 'DISCONNECTED', 'DISCONNECTING'].includes(report.status));
    assert.equal(typeof report.readyState, 'number');
  });

  it('health controller returns 503 with degraded status when disconnected', async () => {
    const { res, state } = createMockResponse();
    const req = {} as Request;

    // Save previous readyState
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

    try {
      await healthController(req, res);
      assert.equal(state.statusCode, 503);
      const body = state.body as { success: boolean; data: { status: string; database: { status: string } } };
      assert.equal(body.success, false);
      assert.equal(body.data.status, 'degraded');
      assert.equal(body.data.database.status, 'DISCONNECTED');
    } finally {
      Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
    }
  });

  it('errorHandler maps Mongoose CastError to 400 INVALID_IDENTIFIER', () => {
    const { res, state } = createMockResponse();
    const req = { method: 'GET', path: '/api/v1/facilities/bad-id' } as Request;
    const next = () => {};

    const castError = new mongoose.Error.CastError('ObjectId', 'bad-id', '_id');
    errorHandler(castError, req, res, next);

    assert.equal(state.statusCode, 400);
    const body = state.body as { success: boolean; error: { code: string; message: string } };
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_IDENTIFIER');
  });
});
