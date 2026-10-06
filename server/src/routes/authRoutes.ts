import { Router } from 'express';
import {
  adminLoginController,
  loginController,
  logoutController,
  meController,
  refreshController,
  registerAmbulanceDriverController,
  registerAmbulanceProviderController,
  registerHospitalController,
  registerUserController,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import {
  ambulanceDriverRegistrationSchema,
  ambulanceProviderRegistrationSchema,
  hospitalRegistrationSchema,
  loginSchema,
  userRegistrationSchema,
} from '../schemas/auth.js';

export const authRouter = Router();

authRouter.post('/register/user', validateBody(userRegistrationSchema), registerUserController);
authRouter.post('/register/hospital', validateBody(hospitalRegistrationSchema), registerHospitalController);
authRouter.post('/register/ambulance-provider', validateBody(ambulanceProviderRegistrationSchema), registerAmbulanceProviderController);
authRouter.post('/register/ambulance-driver', validateBody(ambulanceDriverRegistrationSchema), registerAmbulanceDriverController);

authRouter.post('/login', validateBody(loginSchema), loginController);
authRouter.post('/admin/login', validateBody(loginSchema), adminLoginController);
authRouter.get('/me', authenticate, meController);
authRouter.post('/logout', logoutController);
authRouter.post('/refresh', refreshController);
