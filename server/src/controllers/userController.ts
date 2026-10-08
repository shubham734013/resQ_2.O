import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as userService from '../services/userService.js';
import { getUserProfile, updateUserProfile } from '../services/authService.js';

const userId=(req:Request)=>{
  const auth=(req as AuthenticatedRequest).auth;
  if(!auth||auth.role!=='USER')throw new Error('User authentication required');
  return auth.id;
};

export const getProfile=async(req:Request,res:Response)=>sendSuccess(res,await getUserProfile((req as AuthenticatedRequest).auth!));
export const updateProfile=async(req:Request,res:Response)=>sendSuccess(res,await updateUserProfile((req as AuthenticatedRequest).auth!,req.body));
export const listSavedFacilities=async(req:Request,res:Response)=>sendSuccess(res,await userService.listSavedFacilities(userId(req)));
export const addSavedFacility=async(req:Request,res:Response)=>sendSuccess(res,await userService.addSavedFacility(userId(req),String(req.params.facilityId)));
export const removeSavedFacility=async(req:Request,res:Response)=>sendSuccess(res,await userService.removeSavedFacility(userId(req),String(req.params.facilityId)));
