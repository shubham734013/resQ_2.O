import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import type { Role } from '../types/roles.js';
import { AppError } from '../utils/AppError.js';

export const authorizeRole = (...roles: Role[]) => function authorize(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    next(new AppError('UNAUTHORIZED', 'Authentication is required', 401));
    return;
  }

  if (!roles.includes(req.auth.role)) {
    next(new AppError('FORBIDDEN', 'You do not have permission to access this resource', 403));
    return;
  }

  next();
};
