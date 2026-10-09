import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/emergencyService.js';

const userId=(req:Request)=>{
  const auth=(req as AuthenticatedRequest).auth;
  if(!auth||auth.role!=='USER')throw new Error('Authentication required');
  return auth.id;
};
const paramId=(req:Request):string=>{
  const value=req.params.id;
  if(typeof value!=='string')throw new Error('Invalid emergency id');
  return value;
};
const query=<T>(res:Response)=>res.locals.validatedQuery as T;

export const createEmergency=async(req:Request,res:Response)=>sendSuccess(res,await service.createEmergencyRequest(userId(req),(res.locals.validatedBody ?? req.body)),201);
export const listEmergencies=async(req:Request,res:Response)=>sendSuccess(res,await service.listUserEmergencyRequests(userId(req),query(res)));
export const getEmergency=async(req:Request,res:Response)=>sendSuccess(res,await service.getUserEmergencyRequest(userId(req),paramId(req)));
export const cancelEmergency=async(req:Request,res:Response)=>sendSuccess(res,await service.cancelUserEmergencyRequest(userId(req),paramId(req)));
