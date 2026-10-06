import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, AuthApiError } from '../services/authApi';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import type { UserRole } from '../types/auth';

const roleHome: Record<UserRole, string> = {
  USER: '/', HOSPITAL: '/hospital', AMBULANCE_PROVIDER: '/ambulance/provider', AMBULANCE_DRIVER: '/ambulance', ADMIN: '/admin',
};

const errorMessage = (error: unknown): string => {
  if (error instanceof AuthApiError) {
    if (error.code === 'ACCOUNT_PENDING') return 'Your account is pending operational approval.';
    if (error.code === 'ACCOUNT_SUSPENDED') return 'Your account has been suspended. Please contact ResQ support.';
    if (error.code === 'ACCOUNT_REJECTED') return 'Your account was rejected and cannot sign in.';
    if (error.code === 'INVALID_CREDENTIALS') return 'Invalid email or password.';
    if (error.status === 403) return 'You are not allowed to sign in with this account.';
    if (error.status >= 500) return 'ResQ is temporarily unavailable. Please try again.';
  }
  return 'Unable to sign in. Please check your details and try again.';
};

export const LoginPage = ({ admin = false }: { admin?: boolean }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleHint, setRoleHint] = useState<'USER' | 'AMBULANCE_PROVIDER'>('USER');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finishLogin = useCallback((user: { role: UserRole }) => {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && user.role === 'USER' ? from : roleHome[user.role], { replace: true });
  }, [location.state, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setIsSubmitting(true);
    try {
      const user = await login({ email, password });
      if (admin && user.role !== 'ADMIN') { setError('This account is not an administrator account.'); return; }
      finishLogin(user);
    } catch (submitError) { setError(errorMessage(submitError)); }
    finally { setIsSubmitting(false); }
  };

  if (admin) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-8"><div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Compass className="h-5 w-5" /></div><div><p className="font-bold text-slate-950">ResQ</p><p className="text-xs text-slate-500">Operations access</p></div></div>
          <h1 className="text-2xl font-bold text-slate-950">Admin sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Use your administrator account.</p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label className="block"><span className="text-sm font-medium text-slate-700">Email</span><input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500" /></label>
            <label className="block"><span className="text-sm font-medium text-slate-700">Password</span><input required value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500" /></label>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-lg bg-slate-900 text-white font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="mt-6 text-center text-sm"><Link className="text-slate-600 hover:text-slate-950" to="/login">Back to standard sign in</Link></p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-8"><div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Compass className="h-5 w-5" /></div><div><p className="font-bold text-slate-950">ResQ</p><p className="text-xs text-slate-500">Healthcare Navigation</p></div></div>
        <h1 className="text-2xl font-bold text-slate-950">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Use your registered ResQ account.</p>
        <div className="mt-5 rounded-lg bg-slate-50 p-1 grid grid-cols-2 gap-1">
          <button type="button" onClick={() => setRoleHint('USER')} className={`h-9 rounded-md text-sm font-semibold ${roleHint === 'USER' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-500'}`}>User</button>
          <button type="button" onClick={() => setRoleHint('AMBULANCE_PROVIDER')} className={`h-9 rounded-md text-sm font-semibold ${roleHint === 'AMBULANCE_PROVIDER' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-500'}`}>Ambulance Provider</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block"><span className="text-sm font-medium text-slate-700">Email</span><input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500" /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700">Password</span><input required value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500" /></label>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60 inline-flex items-center justify-center gap-2">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <SocialAuthButtons
          roleHint={roleHint}
          onSuccess={finishLogin}
          onError={setError}
        />
        <p className="mt-6 text-center text-sm text-slate-500">New to ResQ? <Link className="font-semibold text-slate-900 hover:underline" to="/register">Create an account</Link></p>
      </section>
    </main>
  );
};