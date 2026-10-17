import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10000;

export const resetRateLimitBuckets = (): void => {
  buckets.clear();
};

const pruneExpiredBuckets = (now: number): void => {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

export const rateLimit = ({ windowMs, max, keyPrefix }: { windowMs: number; max: number; keyPrefix: string }) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      next();
      return;
    }
    // Determine client IP safely: use req.ip (honors trust proxy) or sanitized fallback
    const sourceIp =
      req.ip ||
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.socket?.remoteAddress ||
      'unknown';
    const key = `${keyPrefix}:${sourceIp}`;
    const now = Date.now();

    // Prevent unbounded memory growth with strict capacity bound
    if (buckets.size >= MAX_BUCKETS) {
      pruneExpiredBuckets(now);
      while (buckets.size >= MAX_BUCKETS) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey) {
          buckets.delete(oldestKey);
        } else {
          break;
        }
      }
    }

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    const effectiveMax = process.env.NODE_ENV !== 'production' ? Math.max(max, 1000) : max;
    if (existing.count >= effectiveMax) {
      next(new AppError('RATE_LIMITED', 'Too many requests. Please try again later.', 429));
      return;
    }
    existing.count += 1;
    next();
  };

