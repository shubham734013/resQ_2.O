import { Schema, model } from 'mongoose';
import type { Role } from '../types/roles.js';
export type ExternalAuthProvider = 'GOOGLE' | 'MICROSOFT';
export interface ExternalIdentityDocument {
  provider: ExternalAuthProvider;
  providerSubject: string;
  accountId: string;
  role: Role;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<ExternalIdentityDocument>({
  provider: { type: String, enum: ['GOOGLE','MICROSOFT'], required: true, index: true },
  providerSubject: { type: String, required: true },
  accountId: { type: String, required: true, index: true },
  role: { type: String, required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
},{timestamps:true});
schema.index({ provider:1, providerSubject:1 },{unique:true});
schema.index({ accountId:1, provider:1 },{unique:true});
export const ExternalIdentityModel=model<ExternalIdentityDocument>('ExternalIdentity',schema);
