import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  connectionPromise = mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await connectionPromise;
    console.info('MongoDB connected');
  } catch (error: unknown) {
    connectionPromise = null;
    console.error('MongoDB connection failed');
    throw error;
  }
};

mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.info('MongoDB reconnected'));

export const disconnectDatabase = async (): Promise<void> => {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.info('MongoDB connection closed');
  }
};
