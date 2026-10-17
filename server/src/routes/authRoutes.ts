import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  adminLoginController,
  driverProfileController,
  linkSocialController,
  listActiveProvidersController,
  loginController,
  logoutController,
  meController,
  providerProfileController,
  refreshController,
  registerAmbulanceDriverController,
  registerAmbulanceProviderController,
  registerHospitalController,
  registerUserController,
  socialLoginController,
  forgotPasswordController,
  resetPasswordController,
  adminMfaVerifyLoginController,
  adminMfaSetupController,
  adminMfaConfirmSetupController,
  adminMfaDisableController,
  adminMfaStatusController,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeRole } from '../middlewares/authorizeRole.js';
import { validateBody } from '../middlewares/validate.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import {
  ambulanceDriverRegistrationSchema,
  ambulanceProviderRegistrationSchema,
  hospitalRegistrationSchema,
  loginSchema,
  userRegistrationSchema,
  socialAuthSchema,
  driverProfileSchema,
  providerProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  adminMfaVerifyLoginSchema,
  adminMfaConfirmSetupSchema,
  adminMfaDisableSchema,
} from '../schemas/auth.js';

export const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth' });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'admin-auth' });
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'refresh' });

authRouter.get('/', (_: Request, res: Response) => {
  res.json({ message: 'Please log in via /login endpoint' });
});

authRouter.get('/ambulance-providers', listActiveProvidersController);
authRouter.post('/register', authLimiter, validateBody(userRegistrationSchema), registerUserController);
authRouter.post('/register/user', authLimiter, validateBody(userRegistrationSchema), registerUserController);
authRouter.post('/register/hospital', authLimiter, validateBody(hospitalRegistrationSchema), registerHospitalController);
authRouter.post('/register/ambulance-provider', authLimiter, validateBody(ambulanceProviderRegistrationSchema), registerAmbulanceProviderController);
authRouter.post('/register/ambulance-driver', authLimiter, validateBody(ambulanceDriverRegistrationSchema), registerAmbulanceDriverController);

authRouter.post('/login/user', authLimiter, validateBody(loginSchema), (req: Request, res: Response, next: NextFunction) => {
  req.body.roleHint = 'USER';
  void loginController(req, res).catch(next);
});

authRouter.post('/login/hospital', authLimiter, validateBody(loginSchema), (req: Request, res: Response, next: NextFunction) => {
  req.body.roleHint = 'HOSPITAL';
  void loginController(req, res).catch(next);
});

authRouter.post('/admin/login', adminLimiter, validateBody(loginSchema), adminLoginController);
authRouter.post('/admin/mfa/verify-login', adminLimiter, validateBody(adminMfaVerifyLoginSchema), adminMfaVerifyLoginController);
authRouter.get('/admin/mfa/status', authenticate, authorizeRole('ADMIN'), adminMfaStatusController);
authRouter.post('/admin/mfa/setup', authenticate, authorizeRole('ADMIN'), adminMfaSetupController);
authRouter.post('/admin/mfa/confirm', authenticate, authorizeRole('ADMIN'), validateBody(adminMfaConfirmSetupSchema), adminMfaConfirmSetupController);
authRouter.post('/admin/mfa/disable', authenticate, authorizeRole('ADMIN'), validateBody(adminMfaDisableSchema), adminMfaDisableController);

authRouter.post('/login', authLimiter, validateBody(loginSchema), loginController);

authRouter.post('/google', authLimiter, validateBody(socialAuthSchema), (req: Request, res: Response, next: NextFunction) => {
  req.params.provider = 'GOOGLE';
  void socialLoginController(req, res).catch(next);
});

authRouter.post('/microsoft', authLimiter, validateBody(socialAuthSchema), (req: Request, res: Response, next: NextFunction) => {
  req.params.provider = 'MICROSOFT';
  void socialLoginController(req, res).catch(next);
});

authRouter.post('/link/google', authenticate, authorizeRole('USER', 'AMBULANCE_PROVIDER'), validateBody(socialAuthSchema), (req: Request, res: Response, next: NextFunction) => {
  req.params.provider = 'GOOGLE';
  void linkSocialController(req, res).catch(next);
});

authRouter.post('/link/microsoft', authenticate, authorizeRole('USER', 'AMBULANCE_PROVIDER'), validateBody(socialAuthSchema), (req: Request, res: Response, next: NextFunction) => {
  req.params.provider = 'MICROSOFT';
  void linkSocialController(req, res).catch(next);
});

authRouter.patch('/driver/profile', authenticate, authorizeRole('AMBULANCE_DRIVER'), validateBody(driverProfileSchema), driverProfileController);
authRouter.patch('/provider/profile', authenticate, authorizeRole('AMBULANCE_PROVIDER'), validateBody(providerProfileSchema), providerProfileController);

authRouter.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), forgotPasswordController);
authRouter.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), resetPasswordController);

authRouter.get('/me', authenticate, meController);
authRouter.post('/logout', logoutController);
authRouter.post('/refresh', refreshLimiter, refreshController);
