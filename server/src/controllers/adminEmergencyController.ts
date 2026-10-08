import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAdminEmergency, getAdminEmergencySummary, listAdminEmergencies } from '../services/adminEmergencyService.js';

const query=<T>(res:Response):T=>res.locals.validatedQuery as T;
const id=(req:Request):string=>{const value=req.params.id;if(typeof value!=='string')throw new Error('Invalid emergency id');return value;};

export const adminEmergenciesController=async(_req:Request,res:Response)=>sendSuccess(res,await listAdminEmergencies(query(res)));
export const adminEmergencyController=async(req:Request,res:Response)=>sendSuccess(res,await getAdminEmergency(id(req)));
export const adminEmergencySummaryController=async(_req:Request,res:Response)=>sendSuccess(res,await getAdminEmergencySummary());
