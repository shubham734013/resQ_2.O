import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthApiError } from '../../services/authApi';
import type { AuthUser } from '../../types/auth';

declare global {
  interface Window {
    google?: { accounts:{ id:{ initialize:(config:{client_id:string;callback:(response:{credential:string})=>void;ux_mode?:'popup'|'redirect'})=>void;renderButton:(parent:HTMLElement,options:Record<string,unknown>)=>void; }; }; };
    msal?: { PublicClientApplication:new(config:{auth:{clientId:string;authority:string;redirectUri:string};cache?:{cacheLocation?:'localStorage'|'sessionStorage'}})=>{initialize?:()=>Promise<void>;loginPopup:(request:{scopes:string[]})=>Promise<{idToken:string}>;}; };
  }
}
const loadScript=(src:string):Promise<void>=>new Promise((resolve,reject)=>{
  const existing=document.querySelector(`script[src="${src}"]`) as HTMLScriptElement|null;
  if(existing){if(existing.dataset.loaded==='true')resolve();else{existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Authentication library failed to load')),{once:true});}return;}
  const script=document.createElement('script');script.src=src;script.async=true;script.defer=true;script.onload=()=>{script.dataset.loaded='true';resolve();};script.onerror=()=>reject(new Error('Authentication library failed to load'));document.head.appendChild(script);
});
interface Props{roleHint:'USER'|'AMBULANCE_PROVIDER';onSuccess:(user:AuthUser)=>void;onError:(message:string)=>void;}
const messageFor=(error:unknown)=>{
  if(error instanceof AuthApiError){
    if(error.code==='ACCOUNT_LINKING_REQUIRED')return 'This email already has a ResQ account. Sign in first, then link this provider.';
    if(error.code==='ROLE_MISMATCH')return 'This social account is already linked to another ResQ role.';
    if(error.code==='ACCOUNT_PENDING')return 'Your ResQ account is awaiting approval.';
    if(error.code==='SOCIAL_AUTH_NOT_CONFIGURED')return 'Social login is not configured on the server.';
  }
  return error instanceof Error?error.message:'Social sign-in failed. Please try again.';
};
export const SocialAuthButtons=({roleHint,onSuccess,onError}:Props)=>{
  const {socialLogin}=useAuth(); const googleContainer=useRef<HTMLDivElement>(null);
  const [loading,setLoading]=useState<'google'|'microsoft'|null>(null);
  const googleClientId=import.meta.env.VITE_GOOGLE_CLIENT_ID as string|undefined;
  const microsoftClientId=import.meta.env.VITE_MICROSOFT_CLIENT_ID as string|undefined;
  const microsoftAuthority=(import.meta.env.VITE_MICROSOFT_AUTHORITY as string|undefined)??'https://login.microsoftonline.com/common';
  useEffect(()=>{
    if(!googleClientId||!googleContainer.current)return; let active=true;
    void loadScript('https://accounts.google.com/gsi/client').then(()=>{
      if(!active||!googleContainer.current||!window.google)return;
      window.google.accounts.id.initialize({client_id:googleClientId,ux_mode:'popup',callback:async({credential})=>{
        setLoading('google');try{onSuccess(await socialLogin('google',{credential,roleHint}));}catch(error){onError(messageFor(error));}finally{setLoading(null);}
      }});
      googleContainer.current.innerHTML='';window.google.accounts.id.renderButton(googleContainer.current,{theme:'outline',size:'large',width:360,text:'continue_with',shape:'rectangular'});
    }).catch(onError); return()=>{active=false;};
  },[googleClientId,roleHint,socialLogin,onSuccess,onError]);
  const handleMicrosoft=async()=>{
    if(!microsoftClientId){onError('Microsoft sign-in needs VITE_MICROSOFT_CLIENT_ID.');return;} setLoading('microsoft');
    try{await loadScript('https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js');if(!window.msal)throw new Error('Microsoft authentication library failed to load.');
      const app=new window.msal.PublicClientApplication({auth:{clientId:microsoftClientId,authority:microsoftAuthority,redirectUri:window.location.origin},cache:{cacheLocation:'sessionStorage'}});
      if(app.initialize)await app.initialize();const result=await app.loginPopup({scopes:['openid','profile','email']});
      if(!result.idToken)throw new Error('Microsoft did not return an ID token.');onSuccess(await socialLogin('microsoft',{credential:result.idToken,roleHint}));
    }catch(error){onError(messageFor(error));}finally{setLoading(null);}
  };
  return <div className="mt-6 space-y-3">
    <div className="relative flex items-center"><div className="flex-1 border-t border-slate-200"/><span className="px-3 text-xs text-slate-400">OR CONTINUE WITH</span><div className="flex-1 border-t border-slate-200"/></div>
    <div className="min-h-10 flex justify-center">{googleClientId?<div ref={googleContainer} aria-label="Continue with Google"/>:<p className="text-xs text-amber-600">Google sign-in needs VITE_GOOGLE_CLIENT_ID.</p>}</div>
    <button type="button" onClick={()=>void handleMicrosoft()} disabled={loading!==null||!microsoftClientId} className="w-full h-11 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center gap-2">{loading==='microsoft'&&<Loader2 className="h-4 w-4 animate-spin"/>}Continue with Microsoft</button>
  </div>;
};