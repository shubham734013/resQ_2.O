import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTestDatabaseTarget,
  resolveTestDatabaseUri,
  PROHIBITED_DATABASE_NAMES,
} from '../config/testDatabase.js';

test('Test Database Isolation: target validation guards', async (t) => {
  await t.test('rejects undefined, empty, or whitespace-only URI', () => {
    assert.equal(validateTestDatabaseTarget(undefined).ok, false);
    assert.equal(validateTestDatabaseTarget('').ok, false);
    assert.equal(validateTestDatabaseTarget('   ').ok, false);
    assert.match(
      validateTestDatabaseTarget(undefined).error ?? '',
      /TEST_MONGODB_URI is required/i
    );
  });

  await t.test('rejects malformed URI string', () => {
    const res = validateTestDatabaseTarget('not-a-valid-uri');
    assert.equal(res.ok, false);
    assert.match(res.error ?? '', /Invalid MongoDB URI format/i);
  });

  await t.test('rejects unsupported protocols', () => {
    const res = validateTestDatabaseTarget('http://localhost:27017/my_test');
    assert.equal(res.ok, false);
    assert.match(res.error ?? '', /Unsupported MongoDB URI protocol/i);
  });

  await t.test('rejects URI with missing database name', () => {
    const res = validateTestDatabaseTarget('mongodb://localhost:27017/');
    assert.equal(res.ok, false);
    assert.match(res.error ?? '', /Missing database name/i);
  });

  await t.test('strictly rejects primary development and production database targets', () => {
    for (const name of PROHIBITED_DATABASE_NAMES) {
      const uri = `mongodb://localhost:27017/${name}`;
      const res = validateTestDatabaseTarget(uri);
      assert.equal(res.ok, false, `Must reject prohibited target '${name}'`);
      assert.match(res.error ?? '', /Prohibited database target/i);

      // Also test uppercase / mixed case
      const upperRes = validateTestDatabaseTarget(`mongodb://localhost:27017/${name.toUpperCase()}`);
      assert.equal(upperRes.ok, false, `Must reject uppercase prohibited target '${name.toUpperCase()}'`);
    }

    // Explicit check for ResQ
    const resqRes = validateTestDatabaseTarget('mongodb+srv://admin:pass@cluster0.mongodb.net/ResQ?retryWrites=true');
    assert.equal(resqRes.ok, false);
    assert.match(resqRes.error ?? '', /Prohibited database target/i);
  });

  await t.test('rejects database targets that do not contain "test"', () => {
    const res = validateTestDatabaseTarget('mongodb://localhost:27017/resq_analytics');
    assert.equal(res.ok, false);
    assert.match(res.error ?? '', /must explicitly contain 'test'/i);
  });

  await t.test('accepts valid isolated test database targets', () => {
    const valid1 = validateTestDatabaseTarget('mongodb://localhost:27017/resq_automated_test');
    assert.equal(valid1.ok, true);
    assert.equal(valid1.databaseName, 'resq_automated_test');

    const valid2 = validateTestDatabaseTarget('mongodb+srv://user:secret@cluster0.mongodb.net/resq_test?retryWrites=true&w=majority');
    assert.equal(valid2.ok, true);
    assert.equal(valid2.databaseName, 'resq_test');
    assert.ok(!valid2.sanitizedUri?.includes('secret'), 'Credentials must be sanitized');
  });
});

test('Test Database Isolation: URI resolution fail-closed behavior', async (t) => {
  await t.test('throws fail-closed error when test env variables are missing and does not use MONGODB_URI', () => {
    const origTest = process.env.TEST_MONGODB_URI;
    const origE2E = process.env.E2E_TEST_MONGODB_URI;
    const origMain = process.env.MONGODB_URI;

    delete process.env.TEST_MONGODB_URI;
    delete process.env.E2E_TEST_MONGODB_URI;
    process.env.MONGODB_URI = 'mongodb://localhost:27017/ResQ';

    try {
      assert.throws(() => resolveTestDatabaseUri(), {
        message: /E2E Database Isolation Guard: TEST_MONGODB_URI is not set/i,
      });
    } finally {
      if (origTest !== undefined) process.env.TEST_MONGODB_URI = origTest;
      if (origE2E !== undefined) process.env.E2E_TEST_MONGODB_URI = origE2E;
      if (origMain !== undefined) process.env.MONGODB_URI = origMain;
    }
  });

  await t.test('accepts explicit URI argument over environment variables', () => {
    const explicit = 'mongodb://localhost:27017/explicit_test_db';
    const resolved = resolveTestDatabaseUri(explicit);
    assert.equal(resolved, explicit);
  });

  await t.test('resolves TEST_MONGODB_URI when set', () => {
    const origTest = process.env.TEST_MONGODB_URI;
    process.env.TEST_MONGODB_URI = 'mongodb://localhost:27017/env_test_db';
    try {
      const resolved = resolveTestDatabaseUri();
      assert.equal(resolved, 'mongodb://localhost:27017/env_test_db');
    } finally {
      if (origTest !== undefined) {
        process.env.TEST_MONGODB_URI = origTest;
      } else {
        delete process.env.TEST_MONGODB_URI;
      }
    }
  });
});
