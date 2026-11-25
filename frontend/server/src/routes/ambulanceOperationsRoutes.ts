import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { validateBody } from '../middlewares/validate.js';
import { z } from 'zod';
import {
  driverUpdateSchema, driverStatusSchema, driverDutyToggleSchema, ambulanceLocationUpdateSchema,
  driverRequestQuerySchema, driverTripQuerySchema,
} from '../schemas/ambulance.js';
import * as c from '../controllers/ambulanceOperationsController.js';
import * as dispatch from '../controllers/dispatchController.js';

const validateQuery=(schema:z.ZodType)=>(req:Request,res:Response,next:NextFunction):void=>{const result=schema.safeParse(req.query);if(!result.success){next(result.error);return;}res.locals.validatedQuery=result.data;next();};

const driver=Router();
driver.use(authenticate,authorizeRole('AMBULANCE_DRIVER'));
driver.get('/profile',c.driverProfile);
driver.patch('/profile',validateBody(driverUpdateSchema.omit({password:true})),c.driverProfileUpdate);
driver.get('/status',c.driverStatus);
driver.patch('/status',validateBody(driverStatusSchema),c.driverStatusUpdate);
driver.get('/duty',c.driverDutyStatus);
driver.post('/duty/start',validateBody(ambulanceLocationUpdateSchema),c.driverDutyStart);
driver.post('/duty/end',c.driverDutyEnd);
driver.post('/duty/toggle',validateBody(driverDutyToggleSchema),c.driverDutyToggle);
driver.patch('/location',validateBody(ambulanceLocationUpdateSchema),c.driverLocationUpdate);
driver.get('/dispatch-offers',dispatch.driverOffers);
driver.post('/dispatch-offers/:id/accept',dispatch.driverAcceptOffer);
driver.post('/dispatch-offers/:id/reject',dispatch.driverRejectOffer);
driver.get('/requests',validateQuery(driverRequestQuerySchema),c.driverRequests);
driver.get('/requests/:id',c.driverRequest);
driver.post('/requests/:id/accept',c.driverAccept);
driver.post('/requests/:id/reject',c.driverReject);
driver.get('/trips',validateQuery(driverTripQuerySchema),c.driverTrips);
driver.get('/trips/:id',c.driverTrip);
driver.post('/trips/:id/arrived-pickup',c.arrivedPickup);
driver.post('/trips/:id/patient-picked-up',c.patientPickedUp);
driver.post('/trips/:id/arrived-hospital',c.arrivedHospital);
driver.post('/trips/:id/complete',c.completeTrip);
driver.post('/trips/:id/cancel',c.cancelTrip);

export const ambulanceDriverRouter=driver;
