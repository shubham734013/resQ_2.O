import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { authenticateAccessToken } from '../services/authService.js';
import { getCookie, ACCESS_TOKEN_COOKIE } from '../utils/cookies.js';
import { AppError } from '../utils/AppError.js';

const getAccessToken = (req: Request): string | undefined => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim();
  return getCookie(req, ACCESS_TOKEN_COOKIE);
};

export const authenticate = async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
  const token = getAccessToken(req);
  if (!token) {
    next(new AppError('UNAUTHORIZED', 'Authentication is required', 401));
    return;
  }

  try {
    req.auth = await authenticateAccessToken(token);
    next();
  } catch (error: unknown) {
    next(error);
  }
};
