import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { validateBody } from '../middlewares/validate.js';
import { accountStatusSchema, ambulanceListQuerySchema, driverListQuerySchema, hospitalListQuerySchema, providerListQuerySchema, userListQuerySchema, verificationStatusSchema } from '../schemas/admin.js';
import { overviewController,usersController,userController,userStatusController,hospitalsController,hospitalController,hospitalVerificationController,hospitalStatusController,providersController,providerController,providerVerificationController,providerStatusController,ambulancesController,ambulanceController,driversController,driverController,driverVerificationController,driverStatusController } from '../controllers/adminController.js';
import type { z } from 'zod';

const validateQuery=(schema:z.ZodType)=> (req:Request,_res:Response,next:NextFunction):void=>{
  const result=schema.safeParse(req.query);
  if(!result.success){next(result.error);return;}
  req.query = result.data as Request['query'];
  next();
};

export const adminRouter=Router();
adminRouter.use(authenticate,authorizeRole('ADMIN'));
adminRouter.get('/overview',overviewController);
adminRouter.get('/users',validateQuery(userListQuerySchema),usersController);
adminRouter.get('/users/:id',userController);
adminRouter.patch('/users/:id/status',validateBody(accountStatusSchema),userStatusController);
adminRouter.get('/hospitals',validateQuery(hospitalListQuerySchema),hospitalsController);
adminRouter.get('/hospitals/:id',hospitalController);
adminRouter.patch('/hospitals/:id/verification',validateBody(verificationStatusSchema),hospitalVerificationController);
adminRouter.patch('/hospitals/:id/status',validateBody(accountStatusSchema),hospitalStatusController);
adminRouter.get('/ambulance-providers',validateQuery(providerListQuerySchema),providersController);
adminRouter.get('/ambulance-providers/:id',providerController);
adminRouter.patch('/ambulance-providers/:id/verification',validateBody(verificationStatusSchema),providerVerificationController);
adminRouter.patch('/ambulance-providers/:id/status',validateBody(accountStatusSchema),providerStatusController);
adminRouter.get('/ambulances',validateQuery(ambulanceListQuerySchema),ambulancesController);
adminRouter.get('/ambulances/:id',ambulanceController);
adminRouter.get('/ambulance-drivers',validateQuery(driverListQuerySchema),driversController);
adminRouter.get('/ambulance-drivers/:id',driverController);
adminRouter.patch('/ambulance-drivers/:id/verification',validateBody(verificationStatusSchema),driverVerificationController);
adminRouter.patch('/ambulance-drivers/:id/status',validateBody(accountStatusSchema),driverStatusController);
