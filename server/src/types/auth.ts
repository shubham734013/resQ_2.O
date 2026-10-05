import type { Request } from 'express';
import type { AccountStatus, Role } from './roles.js';

export interface AuthenticatedIdentity {
  id: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthenticatedIdentity;
}

export interface JwtClaims {
  sub: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  type: 'access' | 'refresh';
  jti?: string;
}
