import mongoose from 'mongoose';
import { sanitizeMongoUri } from './database.js';

export interface TestDatabaseValidationResult {
  ok: boolean;
  error?: string;
  databaseName?: string;
  sanitizedUri?: string;
}

export const PROHIBITED_DATABASE_NAMES = [
  'resq',
  'production',
  'prod',
  'live',
  'master',
  'main',
];

export const validateTestDatabaseTarget = (uri?: string): TestDatabaseValidationResult => {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    return {
      ok: false,
      error: 'TEST_MONGODB_URI is required for destructive test execution. Never run tests against an unconfigured database or default development database.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Invalid MongoDB URI format: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') {
    return {
      ok: false,
      error: `Unsupported MongoDB URI protocol '${parsed.protocol}'. Expected 'mongodb:' or 'mongodb+srv:'`,
    };
  }

  const databaseName = parsed.pathname.replace(/^\//, '').split('?')[0]?.trim();
  if (!databaseName) {
    return {
      ok: false,
      error: 'Missing database name in connection URI. An explicit test database name is required.',
    };
  }

  const normalizedDb = databaseName.toLowerCase();

  for (const prohibited of PROHIBITED_DATABASE_NAMES) {
    if (normalizedDb === prohibited || normalizedDb === `${prohibited}_db` || normalizedDb === `db_${prohibited}`) {
      return {
        ok: false,
        error: `Prohibited database target '${databaseName}'. Destructive test execution must never target production or primary development database '${prohibited}'.`,
      };
    }
  }

  if (!normalizedDb.includes('test')) {
    return {
      ok: false,
      error: `Unsafe database target '${databaseName}'. The test database name must explicitly contain 'test' (e.g. 'resq_automated_test', 'resq_test').`,
    };
  }

  return {
    ok: true,
    databaseName,
    sanitizedUri: sanitizeMongoUri(uri),
  };
};

export const resolveTestDatabaseUri = (explicitUri?: string): string => {
  const candidate = explicitUri || process.env.TEST_MONGODB_URI || process.env.E2E_TEST_MONGODB_URI;
  if (!candidate) {
    throw new Error(
      'E2E Database Isolation Guard: TEST_MONGODB_URI is not set. ' +
      'Destructive test workflows fail closed and will never silently fall back to MONGODB_URI. ' +
      'Please provide TEST_MONGODB_URI pointing to an isolated test database containing "test" in its name (e.g. "resq_automated_test").'
    );
  }
  return candidate;
};

export const connectTestDatabase = async (options?: { explicitUri?: string }): Promise<{ databaseName: string; sanitizedUri: string }> => {
  const rawUri = resolveTestDatabaseUri(options?.explicitUri);
  const validation = validateTestDatabaseTarget(rawUri);

  if (!validation.ok || !validation.databaseName) {
    throw new Error(`E2E Database Isolation Guard Failed: ${validation.error}`);
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(rawUri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 1,
    autoIndex: true,
  });

  const connectedName = mongoose.connection.name || '';
  const postValidation = validateTestDatabaseTarget(`mongodb://127.0.0.1:27017/${connectedName}`);
  if (!postValidation.ok) {
    await mongoose.disconnect();
    throw new Error(`Connected database '${connectedName}' failed safety verification: ${postValidation.error}`);
  }

  console.info(`Connected to isolated test database: ${validation.databaseName}`);
  return {
    databaseName: validation.databaseName,
    sanitizedUri: validation.sanitizedUri || '',
  };
};
