import { z } from 'zod';
import type { ZodType } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validateBody = <T>(schema: ZodType<T>) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const error = new Error('Request validation failed') as Error & { statusCode: number; code: string; details: z.ZodIssue[] };
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = result.error.issues;
    next(error);
    return;
  }
  req.body = result.data;
  res.locals.validatedBody = result.data;
  next();
};

export const validateQuery = <T>(schema: ZodType<T>) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const error = new Error('Query validation failed') as Error & { statusCode: number; code: string; details: z.ZodIssue[] };
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = result.error.issues;
    next(error);
    return;
  }
  res.locals.validatedQuery = result.data;
  next();
};
