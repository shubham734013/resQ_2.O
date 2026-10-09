import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, AuthApiError } from '../services/authApi';
import type { AmbulanceDriverRegistrationRequest, AmbulanceProviderRegistrationRequest, AuthState, AuthUser, HospitalRegistrationRequest, LoginRequest, SocialAuthRequest, UserRegistrationRequest, UserRole } from '../types/auth';

interface AuthContextValue extends AuthState {
  role: UserRole | null;
  login:(input:LoginRequest)=>Promise<AuthUser>;
  socialLogin:(provider:'google'|'microsoft',input:SocialAuthRequest)=>Promise<AuthUser>;
  register:{user:(input:UserRegistrationRequest)=>Promise<AuthUser>;hospital:(input:HospitalRegistrationRequest)=>Promise<AuthUser>;ambulanceProvider:(input:AmbulanceProviderRegistrationRequest)=>Promise<AuthUser>;ambulanceDriver:(input:AmbulanceDriverRegistrationRequest)=>Promise<AuthUser>};
  logout:()=>Promise<void>;
  refreshUser:()=>Promise<AuthUser|null>;
}
const AuthContext=createContext<AuthContextValue|null>(null);
const getUserFromResponse=(response:{data:{user:AuthUser}}):AuthUser=>response.data.user;

export const AuthProvider=({children}:{children:ReactNode})=>{
  const queryClient = useQueryClient();
  const [state,setState]=useState<AuthState>({user:null,isAuthenticated:false,isLoading:true});
  // A late startup /auth/me response must not overwrite a newer successful login.
  const authOperationVersion=useRef(0);
  const setAuthenticatedUser=useCallback((user:AuthUser|null)=>setState({user,isAuthenticated:user!==null,isLoading:false}),[]);
  const refreshUser=useCallback(async():Promise<AuthUser|null>=>{
    const operationVersion=++authOperationVersion.current;
    try{
      const user=(await authApi.me()).data;
      if(operationVersion===authOperationVersion.current)setAuthenticatedUser(user);
      return user;
    }catch(error){
      if(!(error instanceof AuthApiError)||error.status!==401){
        if(operationVersion===authOperationVersion.current)setAuthenticatedUser(null);
        throw error;
      }
      try{
        const user=getUserFromResponse(await authApi.refresh());
        if(operationVersion===authOperationVersion.current)setAuthenticatedUser(user);
        return user;
      }catch(refreshError){
        if(operationVersion===authOperationVersion.current)setAuthenticatedUser(null);
        if(refreshError instanceof AuthApiError&&refreshError.status===401)return null;
        throw refreshError;
      }
    }
  },[setAuthenticatedUser]);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(()=>{void refreshUser().catch(()=>undefined);},[refreshUser]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const login=useCallback(async(input:LoginRequest)=>{
    const operationVersion=++authOperationVersion.current;
    try{
      const user=getUserFromResponse(await authApi.login(input));
      queryClient.clear();
      if(operationVersion===authOperationVersion.current)setAuthenticatedUser(user);
      return user;
    }catch(error){
      if(operationVersion===authOperationVersion.current)setAuthenticatedUser(null);
      throw error;
    }
  },[queryClient,setAuthenticatedUser]);
  const socialLogin=useCallback(async(provider:'google'|'microsoft',input:SocialAuthRequest)=>{
    const operationVersion=++authOperationVersion.current;
    try{
      const user=getUserFromResponse(await authApi.socialLogin(provider,input));
      queryClient.clear();
      if(operationVersion===authOperationVersion.current)setAuthenticatedUser(user);
      return user;
    }catch(error){
      if(operationVersion===authOperationVersion.current)setAuthenticatedUser(null);
      throw error;
    }
  },[queryClient,setAuthenticatedUser]);
  const logout=useCallback(async()=>{
    const operationVersion=++authOperationVersion.current;
    try{await authApi.logout();}
    finally{
      if(operationVersion===authOperationVersion.current){queryClient.clear();setAuthenticatedUser(null);}
    }
  },[queryClient,setAuthenticatedUser]);
  const registerUser=useCallback(async(input:UserRegistrationRequest)=>{
    const operationVersion=++authOperationVersion.current;
    try{
      const res=await authApi.registerUser(input);
      const user=(res.data as AuthUser & {user?:AuthUser}).user??res.data;
      queryClient.clear();
      if(operationVersion===authOperationVersion.current)setAuthenticatedUser(user);
      return user;
    }catch(error){
      if(operationVersion===authOperationVersion.current)setAuthenticatedUser(null);
      throw error;
    }
  },[queryClient,setAuthenticatedUser]);
  const registerHospital=useCallback(async(input:HospitalRegistrationRequest)=>(await authApi.registerHospital(input)).data,[]);
  const registerAmbulanceProvider=useCallback(async(input:AmbulanceProviderRegistrationRequest)=>(await authApi.registerAmbulanceProvider(input)).data,[]);
  const registerAmbulanceDriver=useCallback(async(input:AmbulanceDriverRegistrationRequest)=>(await authApi.registerAmbulanceDriver(input)).data,[]);
  const value=useMemo<AuthContextValue>(()=>({...state,role:state.user?.role??null,login,socialLogin,register:{user:registerUser,hospital:registerHospital,ambulanceProvider:registerAmbulanceProvider,ambulanceDriver:registerAmbulanceDriver},logout,refreshUser}),[state,login,socialLogin,registerUser,registerHospital,registerAmbulanceProvider,registerAmbulanceDriver,logout,refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth=():AuthContextValue=>{const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within AuthProvider');return context;};
