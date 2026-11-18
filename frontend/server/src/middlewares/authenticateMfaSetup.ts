/**
 * authenticateMfaSetup middleware
 *
 * AUTH-02: Validates the short-lived `mfa_setup_pending` JWT returned by adminLogin
 * when MFA has not yet been enrolled. This token is ONLY accepted by the MFA setup
 * and confirm endpoints — it does NOT grant access to any other route.
 *
 * The token payload contains { sub, email, role: 'ADMIN', type: 'mfa_setup_pending' }.
 * We extract these to build a minimal AuthenticatedIdentity for the setup service.
 */
import type { NextFunction, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { AuthenticatedRequest } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';

export const authenticateMfaSetup = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined;

  if (!token) {
    next(new AppError('UNAUTHORIZED', 'MFA setup token is required', 401));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (
      typeof decoded.sub !== 'string' ||
      decoded.type !== 'mfa_setup_pending' ||
      decoded.role !== 'ADMIN'
    ) {
      throw new AppError('INVALID_MFA_SETUP_TOKEN', 'Invalid or expired MFA setup token', 401);
    }

    // Confirm the admin still exists and is active before proceeding.
    const admin = await UserModel.findById(decoded.sub).exec();
    if (!admin || admin.role !== 'ADMIN' || admin.accountStatus !== 'ACTIVE') {
      throw new AppError('UNAUTHORIZED', 'Administrator account not found or inactive', 401);
    }

    req.auth = {
      id: admin._id.toString(),
      email: admin.email,
      name: admin.name,
      role: 'ADMIN',
      accountStatus: admin.accountStatus,
    };
    next();
  } catch (error: unknown) {
    if (error instanceof AppError) {
      next(error);
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('MFA_SETUP_TOKEN_EXPIRED', 'MFA setup session has expired. Please sign in again.', 401));
    } else {
      next(new AppError('INVALID_MFA_SETUP_TOKEN', 'Invalid MFA setup token', 401));
    }
  }
};
