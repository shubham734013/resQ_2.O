import { useEffect, useState } from 'react';
import { Shield, User } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useUpdateUserProfile, useUserProfile } from '../hooks/useUser';
import type { UserProfile } from '../services/userApi';

const initialForm=(p:UserProfile)=>({
  name:p.name,phone:p.phone??'',address:p.address??'',city:p.city??'',state:p.state??'',country:p.country??'',
  latitude:p.latitude?.toString()??'',longitude:p.longitude?.toString()??''
});

export const ProfilePage=()=>{
  const q=useUserProfile();
  const update=useUpdateUserProfile();
  const [form,setForm]=useState({name:'',phone:'',address:'',city:'',state:'',country:'',latitude:'',longitude:''});
  useEffect(()=>{if(q.data)setForm(initialForm(q.data));},[q.data]);
  const set=(field:keyof typeof form,value:string)=>setForm((current)=>({...current,[field]:value}));
  const submit=(e:React.FormEvent)=>{e.preventDefault();
    const payload:Parameters<typeof update.mutate>[0]={
      name:form.name.trim(),phone:form.phone.trim(),address:form.address.trim(),city:form.city.trim(),state:form.state.trim(),country:form.country.trim(),
      ...(form.latitude!==''?{latitude:Number(form.latitude)}:{}),...(form.longitude!==''?{longitude:Number(form.longitude)}:{})
    };
    update.mutate(payload);
  };
  return <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
    <header className="space-y-1"><h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">User Profile</h1><p className="text-sm text-slate-500">Manage the profile information ResQ uses for your account and emergency coordination.</p></header>
    {q.isLoading?<div className="p-10 text-center text-sm text-slate-500">Loading profile…</div>:
    q.isError?<div className="p-5 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-800"><div className="flex items-center justify-between"><span>Unable to load profile.</span><Button size="sm" variant="secondary" onClick={()=>void q.refetch()}>Retry</Button></div></div>:
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-5 shadow-xs">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><User className="w-5 h-5 text-slate-700"/></div><div><h2 className="font-semibold text-slate-900 text-sm">{q.data.name}</h2><p className="text-xs text-slate-500">{q.data.email}</p></div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['name','phone','address','city','state','country','latitude','longitude'] as const).map((field)=><label key={field} className="text-xs font-medium text-slate-600 capitalize">{field}<input value={form[field]} onChange={e=>set(field,e.target.value)} type={field==='latitude'||field==='longitude'?'number':'text'} step={field==='latitude'||field==='longitude'?'any':undefined} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" /></label>)}
      </div>
      {update.isError&&<div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{update.error instanceof Error?update.error.message:'Profile update failed.'}</div>}
      {update.isSuccess&&<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Profile updated successfully.</div>}
      <Button type="submit" variant="primary" disabled={update.isPending}>{update.isPending?'Saving…':'Save changes'}</Button>
    </form>}
    <section className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3 text-xs text-slate-600 shadow-xs"><div className="flex items-center gap-2 font-semibold text-slate-900"><Shield className="w-4 h-4"/><span>Emergency coordination notice</span></div><p className="leading-relaxed">ResQ is a healthcare navigation and emergency coordination platform. It does not diagnose medical conditions or replace local emergency responders.</p></section>
  </div>;
};
