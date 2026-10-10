import { Schema, model } from 'mongoose';
import type { Role } from '../types/roles.js';

export interface AuthSessionDocument {
  accountId: string;
  role: Role;
  tokenId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const authSessionSchema = new Schema<AuthSessionDocument>({
  accountId: { type: String, required: true, index: true },
  role: { type: String, required: true, index: true },
  tokenId: { type: String, required: true, unique: true, index: true },
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSessionModel = model<AuthSessionDocument>('AuthSession', authSessionSchema);
