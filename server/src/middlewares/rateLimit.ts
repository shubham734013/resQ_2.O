import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

type Bucket = { count:number; resetAt:number };
const buckets = new Map<string, Bucket>();

export const rateLimit = ({ windowMs, max, keyPrefix }:{windowMs:number;max:number;keyPrefix:string}) =>
  (req:Request,_res:Response,next:NextFunction):void => {
    const forwarded = req.headers['x-forwarded-for'];
    const sourceIp = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() ?? 'unknown' : req.ip ?? 'unknown';
    const key = `${keyPrefix}:${sourceIp}`;
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key,{count:1,resetAt:now+windowMs});
      next();
      return;
    }
    if (existing.count >= max) {
      next(new AppError('RATE_LIMITED','Too many requests. Please try again later.',429));
      return;
    }
    existing.count += 1;
    next();
  };
