import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, AuthApiError } from '../services/authApi';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import type { LoginRoleHint, UserRole } from '../types/auth';

const roleHome:Record<UserRole,string>={USER:'/',HOSPITAL:'/hospital',AMBULANCE_PROVIDER:'/ambulance/provider',AMBULANCE_DRIVER:'/ambulance',ADMIN:'/admin'};
const errorMessage=(error:unknown)=>{
  if(error instanceof AuthApiError){
    if(error.code==='ACCOUNT_PENDING')return 'Your account is pending operational approval. You will receive access once approved.';
    if(error.code==='ACCOUNT_SUSPENDED')return 'Your account has been suspended. Please contact ResQ support.';
    if(error.code==='ACCOUNT_REJECTED')return 'Your account registration was not approved.';
    if(error.code==='INVALID_CREDENTIALS')return 'Invalid email or password.';
    if(error.code==='ROLE_MISMATCH')return 'This social identity is linked to another ResQ role.';
    if(error.code==='SOCIAL_AUTH_NOT_CONFIGURED')return 'Social login is not configured on the server.';
    if(error.code==='INVALID_SOCIAL_CREDENTIAL')return 'Unable to verify social credentials. Please try again.';
    if(error.code==='SOCIAL_PROVIDER_UNAVAILABLE')return 'Authentication provider is temporarily unavailable. Please try again.';
    if(error.status===403)return 'You do not have permission to access this portal with this account.';
    if(error.status>=500)return 'ResQ is temporarily unavailable. Please try again in a few moments.';
  }
  return error instanceof Error&&error.message?error.message:'Unable to sign in. Please verify your details and try again.';
};

export const LoginPage=({admin=false}:{admin?:boolean})=>{
  const {login,refreshUser}=useAuth();const navigate=useNavigate();const location=useLocation();
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [roleHint,setRoleHint]=useState<LoginRoleHint>('USER');const [error,setError]=useState('');const [isSubmitting,setIsSubmitting]=useState(false);
  const finishLogin=useCallback((user:{role:UserRole})=>{
    const from=(location.state as {from?:string}|null)?.from;
    const isTargetMatch=Boolean(from&&(
      (user.role==='USER'&&!from.startsWith('/hospital')&&!from.startsWith('/ambulance')&&!from.startsWith('/admin'))||
      (user.role==='HOSPITAL'&&from.startsWith('/hospital'))||
      (user.role==='AMBULANCE_PROVIDER'&&from.startsWith('/ambulance'))||
      (user.role==='AMBULANCE_DRIVER'&&from.startsWith('/ambulance'))||
      (user.role==='ADMIN'&&from.startsWith('/admin'))
    ));
    navigate(isTargetMatch&&from?from:roleHome[user.role],{replace:true});
  },[location.state,navigate]);
  const handleSubmit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setError('');if(!email.trim()||!password){setError('Enter your email and password.');return;}setIsSubmitting(true);try{
    if(admin){const user=(await authApi.adminLogin({email,password})).data.user;if(user.role!=='ADMIN'){setError('This account is not an administrator account.');return;}const authenticated=await refreshUser();if(!authenticated){setError('Your session could not be established. Please try again.');return;}finishLogin(authenticated);}
    else finishLogin(await login({email,password,roleHint}));
  }catch(error){setError(errorMessage(error));}finally{setIsSubmitting(false);}};
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10"><section className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
    <div className="flex items-center gap-3 mb-8"><div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Compass className="h-5 w-5"/></div><div><p className="font-bold text-slate-950">ResQ</p><p className="text-xs text-slate-500">{admin?'Operations access':'Healthcare Navigation'}</p></div></div>
    <h1 className="text-2xl font-bold text-slate-950">{admin?'Admin sign in':'Sign in'}</h1><p className="mt-1 text-sm text-slate-500">Use your registered ResQ account.</p>
    {!admin&&<div className="mt-5 rounded-lg bg-slate-50 p-1 grid grid-cols-3 gap-1" aria-label="Account type">
      {([{value:'USER',label:'User'},{value:'AMBULANCE_PROVIDER',label:'Ambulance Provider'},{value:'AMBULANCE_DRIVER',label:'Ambulance Driver'}] as const).map(option=><button key={option.value} type="button" disabled={isSubmitting} onClick={()=>setRoleHint(option.value)} aria-pressed={roleHint===option.value} className={`min-h-10 rounded-md px-2 text-xs sm:text-sm font-semibold ${roleHint===option.value?'bg-white shadow-sm text-slate-950':'text-slate-500'} disabled:opacity-60`}>{option.label}</button>)}
    </div>}
    <form onSubmit={handleSubmit} className="mt-5 space-y-4"><label className="block"><span className="text-sm font-medium text-slate-700">Email</span><input required disabled={isSubmitting} value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 disabled:bg-slate-100"/></label><label className="block"><span className="text-sm font-medium text-slate-700">Password</span><input required disabled={isSubmitting} value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 disabled:bg-slate-100"/></label>
      {error&&<p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60 inline-flex items-center justify-center gap-2">{isSubmitting&&<Loader2 className="h-4 w-4 animate-spin"/>}{isSubmitting?'Signing in…':'Sign in'}</button>
    </form>
    {!admin&&<SocialAuthButtons roleHint={roleHint} onSuccess={finishLogin} onError={setError}/>}
    {!admin&&<p className="mt-6 text-center text-sm text-slate-500">New to ResQ? <Link className="font-semibold text-slate-900 hover:underline" to="/register">Create an account</Link></p>}
    {admin&&<p className="mt-6 text-center text-sm"><Link className="text-slate-600 hover:text-slate-950" to="/login">Back to standard sign in</Link></p>}
  </section></main>;
};
