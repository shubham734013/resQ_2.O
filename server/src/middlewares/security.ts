import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

export const getAllowedOrigins = (): string[] => {
  const raw = process.env.CORS_ORIGINS?.trim();
  return raw ? raw.split(',').map((value) => value.trim()).filter(Boolean) : [];
};

export const originGuard = (req: Request, _res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) {
    next();
    return;
  }
  next(new AppError('CORS_NOT_ALLOWED', 'Request origin is not allowed', 403));
};

export const mutationOriginGuard = (req: Request, _res: Response, next: NextFunction): void => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }
  const allowed = getAllowedOrigins();
  if (!allowed.includes(origin)) {
    next(new AppError('CSRF_ORIGIN_BLOCKED', 'Request origin is not allowed for this operation', 403));
    return;
  }
  next();
};

export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
};
