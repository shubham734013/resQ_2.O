import { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

const writeLog = (payload: Record<string, unknown>): void => {
  process.stderr.write(JSON.stringify({ timestamp: new Date().toISOString(), service: 'resq-api', ...payload }) + '\n');
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req: Request, res: Response, next: NextFunction): void => {
  void next;

  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues,
      },
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ success: false, error: { code: 'MONGO_VALIDATION_ERROR', message: 'Database validation failed' } });
    return;
  }

  if (isMongoDuplicateKeyError(error)) {
    const mongoErr = error as { keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
    const keys = Object.keys(mongoErr.keyPattern || mongoErr.keyValue || {});
    if (keys.includes('email')) {
      res.status(409).json({ success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' } });
      return;
    }
    if (keys.includes('phone')) {
      res.status(409).json({ success: false, error: { code: 'PHONE_ALREADY_EXISTS', message: 'An account with this phone number already exists' } });
      return;
    }
    if (keys.includes('registrationNumber')) {
      res.status(409).json({ success: false, error: { code: 'REGISTRATION_NUMBER_ALREADY_EXISTS', message: 'Registration number is already in use' } });
      return;
    }
    if (keys.includes('licenseNumber')) {
      res.status(409).json({ success: false, error: { code: 'LICENSE_NUMBER_ALREADY_EXISTS', message: 'License number is already in use' } });
      return;
    }
    res.status(409).json({ success: false, error: { code: 'DUPLICATE_RESOURCE', message: 'A resource with the same unique value already exists' } });
    return;
  }

  const err = error instanceof Error ? error : new Error('Unknown error');
  const statusCode = 'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500;
  const code = 'code' in err && typeof err.code === 'string' ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = statusCode >= 500 ? 'Internal server error' : err.message;
  const details = 'details' in err ? err.details : undefined;

  writeLog({ level: statusCode >= 500 ? 'error' : 'warn', code, statusCode, method: req.method, path: req.path });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
};

const isMongoDuplicateKeyError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  return 'code' in error && error.code === 11000;
};
