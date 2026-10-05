import { Schema, model } from 'mongoose';
import { ACCOUNT_STATUSES, ROLES, type AccountStatus, type Role } from '../types/roles.js';

export interface UserDocument {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'USER', index: true },
  address: String,
  city: String,
  state: String,
  country: String,
  latitude: Number,
  longitude: Number,
  accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'PENDING', index: true },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.index({ latitude: 1, longitude: 1 });

export const UserModel = model<UserDocument>('User', userSchema);
