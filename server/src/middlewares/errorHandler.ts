import { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ success: false, error: { code: 'MONGO_VALIDATION_ERROR', message: 'Database validation failed' } });
    return;
  }

  if (isMongoDuplicateKeyError(error)) {
    res.status(409).json({ success: false, error: { code: 'DUPLICATE_RESOURCE', message: 'A resource with the same unique value already exists' } });
    return;
  }

  const err = error instanceof Error ? error : new Error('Unknown error');
  const statusCode = 'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500;
  const code = 'code' in err && typeof err.code === 'string' ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = statusCode >= 500 ? 'Internal server error' : err.message;

  if (statusCode >= 500) console.error(error);
  else console.warn(`${code}: ${message}`);

  res.status(statusCode).json({ success: false, error: { code, message } });
};

const isMongoDuplicateKeyError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  return 'code' in error && error.code === 11000;
};
