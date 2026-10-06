import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';

export const requireOperationalAccess=(req:AuthenticatedRequest,_res:Response,next:NextFunction):void=>{
 const auth=req.auth;
 if(!auth){next(new AppError('UNAUTHORIZED','Authentication is required',401));return;}
 if(auth.accountStatus!=='ACTIVE'){next(new AppError('ACCOUNT_NOT_OPERATIONAL','This account is not operationally active',403));return;}
 if(auth.role==='AMBULANCE_DRIVER'&&(auth.profileCompletionStatus!=='COMPLETE'||auth.licenseVerificationStatus!=='VERIFIED')){next(new AppError('DRIVER_NOT_OPERATIONAL','Complete profile and license verification before operating',403));return;}
 if(auth.role==='AMBULANCE_PROVIDER'&&auth.profileCompletionStatus!=='COMPLETE'){next(new AppError('PROVIDER_PROFILE_INCOMPLETE','Complete provider onboarding before operating',403));return;}
 next();
};
