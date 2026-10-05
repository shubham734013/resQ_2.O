import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';

const BCRYPT_ROUNDS = 12;

const seedAdmin = async (): Promise<void> => {
  await connectDatabase();

  const email = env.RESQ_ADMIN_EMAIL.trim().toLowerCase();
  const existing = await UserModel.findOne({ email }).exec();

  if (existing) {
    if (existing.role !== 'ADMIN') {
      throw new Error('Configured admin email already belongs to a non-admin account');
    }
    console.info('ResQ admin already exists; no changes made');
    return;
  }

  const passwordHash = await bcrypt.hash(env.RESQ_ADMIN_PASSWORD, BCRYPT_ROUNDS);
  await UserModel.create({
    name: 'ResQ Administrator',
    email,
    phone: 'ADMIN-NOT-PUBLIC',
    passwordHash,
    role: 'ADMIN',
    accountStatus: 'ACTIVE',
    emailVerified: true,
    phoneVerified: false,
  });

  console.info('ResQ admin account created');
};

seedAdmin()
  .catch((error: unknown) => {
    console.error('Admin seed failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
