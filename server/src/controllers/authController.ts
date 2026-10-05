import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import {
  adminLogin,
  getCurrentUser,
  login,
  logout,
  refreshAuthentication,
  registerAmbulanceDriver,
  registerAmbulanceProvider,
  registerHospital,
  registerUser,
} from '../services/authService.js';
import { clearAuthCookies, getCookie, REFRESH_TOKEN_COOKIE, setAuthCookies } from '../utils/cookies.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type {
  AmbulanceDriverRegistrationInput,
  AmbulanceProviderRegistrationInput,
  HospitalRegistrationInput,
  LoginInput,
  UserRegistrationInput,
} from '../schemas/auth.js';

export const registerUserController = async (req: Request, res: Response): Promise<void> => {
  const user = await registerUser(req.body as UserRegistrationInput);
  sendSuccess(res, user, 201);
};

export const registerHospitalController = async (req: Request, res: Response): Promise<void> => {
  const hospital = await registerHospital(req.body as HospitalRegistrationInput);
  sendSuccess(res, hospital, 201);
};

export const registerAmbulanceProviderController = async (req: Request, res: Response): Promise<void> => {
  const provider = await registerAmbulanceProvider(req.body as AmbulanceProviderRegistrationInput);
  sendSuccess(res, provider, 201);
};

export const registerAmbulanceDriverController = async (req: Request, res: Response): Promise<void> => {
  const driver = await registerAmbulanceDriver(req.body as AmbulanceDriverRegistrationInput);
  sendSuccess(res, driver, 201);
};

const sendLoginResponse = (res: Response, result: Awaited<ReturnType<typeof login>>): void => {
  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendSuccess(res, { user: result.user });
};

export const loginController = async (req: Request, res: Response): Promise<void> => {
  const result = await login(req.body as LoginInput);
  sendLoginResponse(res, result);
};

export const adminLoginController = async (req: Request, res: Response): Promise<void> => {
  const result = await adminLogin(req.body as LoginInput);
  sendLoginResponse(res, result);
};

export const meController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await getCurrentUser(req.auth!);
  sendSuccess(res, user);
};

export const logoutController = async (req: Request, res: Response): Promise<void> => {
  await logout(getCookie(req, REFRESH_TOKEN_COOKIE));
  clearAuthCookies(res);
  sendSuccess(res, { loggedOut: true });
};

export const refreshController = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = getCookie(req, REFRESH_TOKEN_COOKIE);
  if (!refreshToken) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Refresh session is required' } });
    return;
  }

  const result = await refreshAuthentication(refreshToken);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendSuccess(res, { user: result.user });
};
