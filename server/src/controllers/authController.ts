import type { Request, Response } from 'express';
import type { AuthenticatedRequest, SocialProvider } from '../types/auth.js';
import { adminLogin, getCurrentUser, login, logout, refreshAuthentication, registerAmbulanceDriver, registerAmbulanceProvider, registerHospital, registerUser, socialLogin, linkSocialAccount, updateDriverProfile, updateProviderProfile } from '../services/authService.js';
import { clearAuthCookies, getCookie, REFRESH_TOKEN_COOKIE, setAuthCookies } from '../utils/cookies.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AmbulanceDriverRegistrationInput, AmbulanceProviderRegistrationInput, HospitalRegistrationInput, LoginInput, UserRegistrationInput, SocialAuthInput, DriverProfileInput, ProviderProfileInput } from '../schemas/auth.js';

export const registerUserController=async(req:Request,res:Response)=>{sendSuccess(res,await registerUser(req.body as UserRegistrationInput),201);};
export const registerHospitalController=async(req:Request,res:Response)=>{sendSuccess(res,await registerHospital(req.body as HospitalRegistrationInput),201);};
export const registerAmbulanceProviderController=async(req:Request,res:Response)=>{sendSuccess(res,await registerAmbulanceProvider(req.body as AmbulanceProviderRegistrationInput),201);};
export const registerAmbulanceDriverController=async(req:Request,res:Response)=>{sendSuccess(res,await registerAmbulanceDriver(req.body as AmbulanceDriverRegistrationInput),201);};
const sendLoginResponse=(res:Response,result:Awaited<ReturnType<typeof login>>)=>{setAuthCookies(res,result.accessToken,result.refreshToken);sendSuccess(res,{user:result.user});};
export const loginController=async(req:Request,res:Response)=>sendLoginResponse(res,await login(req.body as LoginInput));
export const adminLoginController=async(req:Request,res:Response)=>sendLoginResponse(res,await adminLogin(req.body as LoginInput));
export const socialLoginController=async(req:Request,res:Response)=>{
  const provider= req.params.provider as SocialProvider;
  const input=req.body as SocialAuthInput;
  const result=await socialLogin(provider,input.credential,input.roleHint);
  sendLoginResponse(res,result);
};
export const linkSocialController=async(req:AuthenticatedRequest,res:Response)=>{
  const provider=req.params.provider as SocialProvider;
  const input=req.body as SocialAuthInput;
  const user=await linkSocialAccount(req.auth!,provider,input.credential);
  sendSuccess(res,user);
};
export const meController=async(req:AuthenticatedRequest,res:Response)=>sendSuccess(res,await getCurrentUser(req.auth!));
export const logoutController=async(req:Request,res:Response)=>{await logout(getCookie(req,REFRESH_TOKEN_COOKIE));clearAuthCookies(res);sendSuccess(res,{loggedOut:true});};
export const refreshController=async(req:Request,res:Response)=>{const token=getCookie(req,REFRESH_TOKEN_COOKIE);if(!token){res.status(401).json({success:false,error:{code:'UNAUTHORIZED',message:'Refresh session is required'}});return;}const result=await refreshAuthentication(token);setAuthCookies(res,result.accessToken,result.refreshToken);sendSuccess(res,{user:result.user});};
export const driverProfileController=async(req:AuthenticatedRequest,res:Response)=>sendSuccess(res,await updateDriverProfile(req.auth!,req.body as DriverProfileInput));
export const providerProfileController=async(req:AuthenticatedRequest,res:Response)=>sendSuccess(res,await updateProviderProfile(req.auth!,req.body as ProviderProfileInput));
