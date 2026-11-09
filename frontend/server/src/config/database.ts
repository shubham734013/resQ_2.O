import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise: Promise<typeof mongoose> | null = null;

export const sanitizeMongoUri = (uri: string): string => {
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@)/g, '$1*****$2');
};

const connectionOptions: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 1,
  autoIndex: env.NODE_ENV !== 'production',
};

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  connectionPromise = mongoose.connect(env.MONGODB_URI, connectionOptions);
  try {
    await connectionPromise;
    console.info('MongoDB connected');
  } catch (error: unknown) {
    connectionPromise = null;
    const message = error instanceof Error ? sanitizeMongoUri(error.message) : 'Unknown connection error';
    console.error(`MongoDB connection failed: ${message}`);
    throw error;
  }
};

mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.info('MongoDB reconnected'));
mongoose.connection.on('error', (err: Error) => {
  console.error('MongoDB connection error:', sanitizeMongoUri(err.message));
});

export const disconnectDatabase = async (): Promise<void> => {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.info('MongoDB connection closed');
  }
};

export interface DatabaseHealthReport {
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'DISCONNECTING';
  readyState: number;
  latencyMs?: number;
}

export const checkDatabaseHealth = async (): Promise<DatabaseHealthReport> => {
  const readyState = mongoose.connection.readyState;
  const statusMap: Record<number, DatabaseHealthReport['status']> = {
    0: 'DISCONNECTED',
    1: 'CONNECTED',
    2: 'CONNECTING',
    3: 'DISCONNECTING',
  };
  const status = statusMap[readyState] ?? 'DISCONNECTED';

  if (readyState !== 1 || !mongoose.connection.db) {
    return { status, readyState };
  }

  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    const latencyMs = Date.now() - start;
    return { status: 'CONNECTED', readyState: 1, latencyMs };
  } catch {
    return { status: 'DISCONNECTED', readyState: mongoose.connection.readyState };
  }
};

