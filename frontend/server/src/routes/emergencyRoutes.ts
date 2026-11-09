import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { validateBody } from '../middlewares/validate.js';
import { z } from 'zod';
import { createEmergencyRequestSchema, cancelEmergencySchema, userEmergencyListQuerySchema, emergencyDiscoveryQuerySchema } from '../schemas/emergency.js';
import { createEmergency, listEmergencies, getEmergency, cancelEmergency, discoverEmergencyHospitals } from '../controllers/emergencyController.js';

const validateQuery=(schema:z.ZodType)=>(req:Request,res:Response,next:NextFunction):void=>{
  const result=schema.safeParse(req.query);
  if(!result.success){next(result.error);return;}
  res.locals.validatedQuery=result.data;
  next();
};

export const emergencyRouter=Router();
emergencyRouter.use(authenticate,authorizeRole('USER'));
emergencyRouter.get('/discovery',validateQuery(emergencyDiscoveryQuerySchema),discoverEmergencyHospitals);
emergencyRouter.post('/',validateBody(createEmergencyRequestSchema),createEmergency);
emergencyRouter.get('/',validateQuery(userEmergencyListQuerySchema),listEmergencies);
emergencyRouter.get('/:id',getEmergency);
emergencyRouter.post('/:id/cancel',validateBody(cancelEmergencySchema),cancelEmergency);
