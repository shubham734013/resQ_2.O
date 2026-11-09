import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Building2,
  Ambulance,
  Navigation,
  AlertCircle,
  Compass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, AuthApiError } from '../services/authApi';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import type { LoginRoleHint, UserRole } from '../types/auth';
import { ROLE_HOMES, isPathAllowedForRole } from '../routes/routePaths';

interface RoleTab {
  value: LoginRoleHint;
  label: string;
  icon: typeof User;
  sub: string;
}

const ROLE_TABS: RoleTab[] = [
  { value: 'USER', label: 'Citizen', icon: User, sub: 'Public access' },
  { value: 'HOSPITAL', label: 'Hospital', icon: Building2, sub: 'Facility portal' },
  { value: 'AMBULANCE_PROVIDER', label: 'Provider', icon: Ambulance, sub: 'Fleet operator' },
  { value: 'AMBULANCE_DRIVER', label: 'Driver', icon: Navigation, sub: 'Field responder' },
];

const errorMessage = (error: unknown): string => {
  if (error instanceof AuthApiError) {
    if (error.code === 'ACCOUNT_PENDING')
      return 'Your account is pending operational approval. You will receive access once approved.';
    if (error.code === 'ACCOUNT_SUSPENDED')
      return 'Your account has been suspended. Please contact ResQ support.';
    if (error.code === 'ACCOUNT_REJECTED')
      return 'Your account registration was not approved.';
    if (error.code === 'INVALID_CREDENTIALS') return 'Invalid email or password.';
    if (error.code === 'ROLE_MISMATCH')
      return 'This social identity is linked to another ResQ role.';
    if (error.code === 'SOCIAL_AUTH_NOT_CONFIGURED')
      return 'Social login is not configured on the server.';
    if (error.code === 'INVALID_SOCIAL_CREDENTIAL')
      return 'Unable to verify social credentials. Please try again.';
    if (error.code === 'SOCIAL_PROVIDER_UNAVAILABLE')
      return 'Authentication provider is temporarily unavailable. Please try again.';
    if (error.status === 403)
      return 'You do not have permission to access this portal with this account.';
    if (error.status >= 500)
      return 'ResQ is temporarily unavailable. Please try again in a few moments.';
  }
  return error instanceof Error && error.message
    ? error.message
    : 'Unable to sign in. Please verify your details and try again.';
};

export const LoginPage = ({ admin = false }: { admin?: boolean }) => {
  const { login, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const requestedPath = (location.state as { from?: string } | null)?.from ?? '';
  const initialRoleHint: LoginRoleHint =
    requestedPath.startsWith('/provider') ||
    requestedPath.startsWith('/ambulance-provider') ||
    requestedPath === '/ambulance/provider'
      ? 'AMBULANCE_PROVIDER'
      : requestedPath.startsWith('/driver') || requestedPath.startsWith('/ambulance')
      ? 'AMBULANCE_DRIVER'
      : requestedPath.startsWith('/hospital')
      ? 'HOSPITAL'
      : 'USER';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleHint, setRoleHint] = useState<LoginRoleHint>(initialRoleHint);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finishLogin = useCallback(
    (user: { role: UserRole }) => {
      const from = (location.state as { from?: string } | null)?.from;
      const isTargetMatch = Boolean(from && isPathAllowedForRole(user.role, from));
      navigate(isTargetMatch && from ? from : ROLE_HOMES[user.role], { replace: true });
    },
    [location.state, navigate]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (admin) {
        const user = (await authApi.adminLogin({ email, password })).data.user;
        if (user.role !== 'ADMIN') {
          setError('This account is not an administrator account.');
          return;
        }
        try {
          localStorage.setItem('resq_has_session', 'true');
        } catch {
          /* ignore */
        }
        const authenticated = await refreshUser();
        if (!authenticated) {
          setError('Your session could not be established. Please try again.');
          return;
        }
        finishLogin(authenticated);
      } else {
        const user = await login({ email, password, roleHint });
        if (user.role !== roleHint) {
          await logout();
          setError(
            `Wrong account type. You selected ${roleHint.replaceAll('_', ' ').toLowerCase()}, but this account is ${user.role.replaceAll('_', ' ').toLowerCase()}. Select the correct account type and try again.`
          );
          return;
        }
        finishLogin(user);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTab = ROLE_TABS.find((t) => t.value === roleHint) ?? ROLE_TABS[0];

  return (
    <main className="min-h-screen bg-[#070709] text-white font-sans selection:bg-rose-500/20 selection:text-rose-200 mesh-bg grid-texture flex items-center justify-center p-6 sm:p-8 relative overflow-hidden">
      
      {/* ─── 1. AMBIENT BACKGROUND RADIANT GLOW ──────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[750px] w-[950px] rounded-full opacity-[0.06]"
          style={{
            background: 'radial-gradient(circle, #f43f5e 0%, #f59e0b 35%, transparent 70%)',
          }}
        />
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-[500px] h-[500px] bg-rose-600/5 rounded-full blur-[160px]" />
      </div>

      <div className="relative w-full max-w-[480px] page-enter z-10">

        {/* ─── 2. BRAND HEADER ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8 px-1">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight text-white group-hover:text-rose-100 transition-colors">
                resQ 2.O
              </p>
              <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-400">
                {admin ? 'Command Operations' : 'Emergency Response Platform'}
              </p>
            </div>
          </Link>

          <Link
            to="/"
            className="text-xs font-mono text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Home</span>
            <Compass className="h-3.5 w-3.5 text-zinc-400" />
          </Link>
        </div>

        {/* ─── 3. FLOATING GLASS CARD ─────────────────────────────────────── */}
        <div className="rounded-3xl p-8 sm:p-11 md:p-12 bg-zinc-950/70 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80">
          
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-white mb-2">
              {admin ? 'Admin Operations Sign In' : 'Sign in to resQ'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
              {admin
                ? 'Restricted sovereign clearance for emergency administrators.'
                : 'Access zero-latency dispatch, clinical routing, and care telemetry.'}
            </p>
          </div>

          {/* Role Segmented Pill Bar — Non-Admin Only */}
          {!admin && (
            <div className="mb-7">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
                Account Type
              </label>

              {/* Segmented Tab Pill Bar with Framer Motion layoutId */}
              <div className="grid grid-cols-4 gap-1 p-1.5 rounded-2xl bg-zinc-900/60 border border-white/10 relative">
                {ROLE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = roleHint === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setRoleHint(tab.value)}
                      aria-pressed={isSelected}
                      className={`relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-center transition-colors duration-200 disabled:opacity-50 z-10 cursor-pointer ${
                        isSelected ? 'text-rose-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="activeRoleTab"
                          transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                          className="absolute inset-0 rounded-xl bg-rose-500/20 border border-rose-500/40 shadow-md shadow-rose-500/10"
                        />
                      )}
                      <Icon className="h-4 w-4 relative z-10" />
                      <span className="text-[11px] font-medium leading-tight relative z-10">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Role Subtext Feedback */}
              <div className="mt-3 px-1 flex items-center gap-2 text-xs font-mono text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                <span>
                  Signing in as <strong className="text-zinc-200 font-semibold">{selectedTab.label}</strong> — {selectedTab.sub}
                </span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="rounded-xl px-4 py-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5 leading-relaxed"
              >
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                Email Address
              </label>
              <input
                required
                disabled={isSubmitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@resq-domain.org"
                className="w-full h-12 px-4 rounded-xl bg-zinc-900/80 border border-white/10 text-zinc-100 placeholder:text-zinc-500 text-sm focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 outline-none transition-all shadow-inner"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-mono text-zinc-400 hover:text-rose-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <input
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="w-full h-12 px-4 pr-11 rounded-xl bg-zinc-900/80 border border-white/10 text-zinc-100 placeholder:text-zinc-500 text-sm focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-600 via-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 hover:scale-[1.01] active:scale-[0.99] btn-shimmer transition-all duration-200 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Social Auth Integration */}
          {!admin && (roleHint === 'USER' || roleHint === 'AMBULANCE_PROVIDER') && (
            <SocialAuthButtons roleHint={roleHint} onSuccess={finishLogin} onError={setError} />
          )}

          {/* Bottom Divider & Navigation */}
          <div className="mt-8 pt-6 border-t border-white/[0.08]">
            {!admin ? (
              <div className="space-y-3 text-center">
                <p className="text-xs text-zinc-400 font-light">
                  Need to find care without signing in?{' '}
                  <Link
                    to="/search"
                    className="font-semibold text-white hover:text-rose-300 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Browse Facility Directory</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </p>

                <p className="text-xs text-zinc-500 font-light">
                  New to the emergency network?{' '}
                  <Link
                    to="/register"
                    className="font-semibold text-white hover:text-rose-300 transition-colors"
                  >
                    Create an account
                  </Link>
                </p>
              </div>
            ) : (
              <p className="text-center text-xs text-zinc-400 font-mono">
                <Link to="/login" className="hover:text-white transition-colors">
                  ← Back to standard user sign in
                </Link>
              </p>
            )}
          </div>

        </div>

        {/* Security Stamp */}
        <p className="mt-8 text-center text-[11px] font-mono text-zinc-500">
          resQ 2.O · Zero-Trust Encryption · ISO 27001 Certified
        </p>

      </div>
    </main>
  );
};

export default LoginPage;
