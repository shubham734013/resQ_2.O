import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { getProfile, updateProfile, listSavedFacilities, addSavedFacility, removeSavedFacility } from '../controllers/userController.js';
import { validateBody } from '../middlewares/validate.js';
import { userProfileUpdateSchema } from '../schemas/auth.js';
import { z } from 'zod';

const facilityParamSchema=z.object({facilityId:z.string().regex(/^[0-9a-fA-F]{24}$/,'Invalid facility id')}).strict();
const validateFacilityParam=(req:import('express').Request,_res:import('express').Response,next:import('express').NextFunction)=>{
  const result=facilityParamSchema.safeParse(req.params);
  if(!result.success){next(result.error);return;}
  next();
};

export const userRouter=Router();
userRouter.use(authenticate,authorizeRole('USER'));
userRouter.get('/profile',getProfile);
userRouter.patch('/profile',validateBody(userProfileUpdateSchema),updateProfile);
userRouter.get('/saved-facilities',listSavedFacilities);
userRouter.post('/saved-facilities/:facilityId',validateFacilityParam,addSavedFacility);
userRouter.delete('/saved-facilities/:facilityId',validateFacilityParam,removeSavedFacility);
