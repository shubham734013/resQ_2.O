import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Compass,
  Loader2,
  Eye,
  EyeOff,
  User,
  Building2,
  Navigation,
  Ambulance,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, AuthApiError } from '../services/authApi';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import type { LoginRoleHint, UserRole } from '../types/auth';
import { ROLE_HOMES, ROUTES, isPathAllowedForRole } from '../routes/routePaths';

interface RoleConfig {
  value: LoginRoleHint;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badge: string;
  tagline: string;
  placeholder: string;
  registerPath: string;
  registerLabel: string;
  activeBg: string;
  activeText: string;
}

const ROLE_CONFIGS: Record<LoginRoleHint, RoleConfig> = {
  USER: {
    value: 'USER',
    label: 'Citizen / User',
    shortLabel: 'User',
    icon: User,
    badge: 'Citizen / Patient Access',
    tagline: 'Emergency SOS dispatch, OPD appointments, and direct care inquiries',
    placeholder: 'citizen@example.com',
    registerPath: ROUTES.PUBLIC.REGISTER_USER,
    registerLabel: 'Register as a Citizen / Patient',
    activeBg: 'bg-blue-600',
    activeText: 'text-white',
  },
  HOSPITAL: {
    value: 'HOSPITAL',
    label: 'Hospital',
    shortLabel: 'Hospital',
    icon: Building2,
    badge: 'Hospital Operations Hub',
    tagline: 'Emergency incoming triage, bed availability, and patient coordination',
    placeholder: 'admin@metrocare.org',
    registerPath: ROUTES.PUBLIC.REGISTER_HOSPITAL,
    registerLabel: 'Register your Hospital or Clinic',
    activeBg: 'bg-teal-600',
    activeText: 'text-white',
  },
  AMBULANCE_DRIVER: {
    value: 'AMBULANCE_DRIVER',
    label: 'Ambulance Driver',
    shortLabel: 'Driver',
    icon: Navigation,
    badge: 'Ambulance Driver Portal',
    tagline: 'Real-time emergency dispatch alerts, GPS turn navigation, and patient handover',
    placeholder: 'driver@fleet.resq.in',
    registerPath: ROUTES.PUBLIC.REGISTER_DRIVER,
    registerLabel: 'Register as an Ambulance Driver',
    activeBg: 'bg-amber-600',
    activeText: 'text-white',
  },
  AMBULANCE_PROVIDER: {
    value: 'AMBULANCE_PROVIDER',
    label: 'Ambulance Provider',
    shortLabel: 'Provider',
    icon: Ambulance,
    badge: 'Ambulance Fleet & Operations',
    tagline: 'Fleet management, crew duty tracking, and ambulance dispatch coordination',
    placeholder: 'dispatch@jaipurems.in',
    registerPath: ROUTES.PUBLIC.REGISTER_PROVIDER,
    registerLabel: 'Register an Ambulance Operator Fleet',
    activeBg: 'bg-indigo-600',
    activeText: 'text-white',
  },
};

const errorMessage = (error: unknown) => {
  if (error instanceof AuthApiError) {
    if (error.code === 'ACCOUNT_PENDING') return 'Your account is pending operational approval. You will receive access once approved.';
    if (error.code === 'ACCOUNT_SUSPENDED') return 'Your account has been suspended. Please contact ResQ support.';
    if (error.code === 'ACCOUNT_REJECTED') return 'Your account registration was not approved.';
    if (error.code === 'INVALID_CREDENTIALS') return 'Invalid email or password.';
    if (error.code === 'ROLE_MISMATCH') return 'This social identity is linked to another ResQ role.';
    if (error.code === 'SOCIAL_AUTH_NOT_CONFIGURED') return 'Social login is not configured on the server.';
    if (error.code === 'INVALID_SOCIAL_CREDENTIAL') return 'Unable to verify social credentials. Please try again.';
    if (error.code === 'SOCIAL_PROVIDER_UNAVAILABLE') return 'Authentication provider is temporarily unavailable. Please try again.';
    if (error.status === 403) return 'You do not have permission to access this portal with this account.';
    if (error.status >= 500) return 'ResQ is temporarily unavailable. Please try again in a few moments.';
  }
  return error instanceof Error && error.message ? error.message : 'Unable to sign in. Please verify your details and try again.';
};

export const LoginPage = ({ admin = false }: { admin?: boolean }) => {
  const { login, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const requestedPath = (location.state as { from?: string } | null)?.from ?? '';

  const initialRoleHint: LoginRoleHint = useMemo(() => {
    const roleParam = (searchParams.get('role') || searchParams.get('type'))?.toUpperCase();
    if (roleParam === 'HOSPITAL') return 'HOSPITAL';
    if (roleParam === 'DRIVER' || roleParam === 'AMBULANCE_DRIVER') return 'AMBULANCE_DRIVER';
    if (roleParam === 'PROVIDER' || roleParam === 'AMBULANCE_PROVIDER') return 'AMBULANCE_PROVIDER';
    if (roleParam === 'USER' || roleParam === 'CITIZEN' || roleParam === 'PATIENT') return 'USER';

    if (requestedPath.startsWith('/provider') || requestedPath.startsWith('/ambulance-provider') || requestedPath === '/ambulance/provider') {
      return 'AMBULANCE_PROVIDER';
    }
    if (requestedPath.startsWith('/driver') || requestedPath.startsWith('/ambulance')) {
      return 'AMBULANCE_DRIVER';
    }
    if (requestedPath.startsWith('/hospital')) {
      return 'HOSPITAL';
    }
    return 'USER';
  }, [requestedPath, searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleHint, setRoleHint] = useState<LoginRoleHint>(initialRoleHint);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentConfig = ROLE_CONFIGS[roleHint];
  const CurrentRoleIcon = currentConfig.icon;

  const finishLogin = useCallback((user: { role: UserRole }) => {
    const from = (location.state as { from?: string } | null)?.from;
    const isTargetMatch = Boolean(from && isPathAllowedForRole(user.role, from));
    navigate(isTargetMatch && from ? from : ROLE_HOMES[user.role], { replace: true });
  }, [location.state, navigate]);

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
        const user = (await authApi.adminLogin({ email: email.trim(), password })).data.user;
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
        const user = await login({ email: email.trim(), password, roleHint });
        if (user.role !== roleHint) {
          await logout();
          setError(`Wrong account type. You selected ${roleHint.replaceAll('_', ' ').toLowerCase()}, but this account is registered as ${user.role.replaceAll('_', ' ').toLowerCase()}. Select the correct role and sign in again.`);
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

  const forgotPasswordLink = useMemo(() => {
    const trimmed = email.trim();
    if (trimmed) {
      return `${ROUTES.PUBLIC.FORGOT_PASSWORD}?email=${encodeURIComponent(trimmed)}`;
    }
    return ROUTES.PUBLIC.FORGOT_PASSWORD;
  }, [email]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10 font-sans">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-8">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-950">ResQ</p>
            <p className="text-xs text-slate-500">{admin ? 'Operations access' : 'Healthcare & Emergency Network'}</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {admin ? 'Admin sign in' : 'Sign in to ResQ'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {admin ? 'Access privileged platform administrative controls.' : 'Choose your role and sign in with your account.'}
        </p>

        {/* Role Segmented Selector for Non-Admin */}
        {!admin && (
          <div className="mt-5 space-y-3">
            <div
              className="rounded-xl bg-slate-100 p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1"
              role="tablist"
              aria-label="Account type"
            >
              {(Object.values(ROLE_CONFIGS) as RoleConfig[]).map((cfg) => {
                const Icon = cfg.icon;
                const isSelected = roleHint === cfg.value;
                return (
                  <button
                    key={cfg.value}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    disabled={isSubmitting}
                    onClick={() => {
                      setRoleHint(cfg.value);
                      setError('');
                    }}
                    className={`min-h-10 rounded-lg px-2 py-1.5 text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                      isSelected
                        ? `${cfg.activeBg} ${cfg.activeText} shadow-xs`
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    } disabled:opacity-60`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{cfg.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Contextual Role Info Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 flex items-start gap-3">
              <div className={`p-2 rounded-xl ${currentConfig.activeBg} text-white shrink-0 shadow-xs`}>
                <CurrentRoleIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-900">{currentConfig.badge}</p>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {currentConfig.shortLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{currentConfig.tagline}</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Email Input */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email address</span>
            <input
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder={admin ? 'admin@resq.in' : currentConfig.placeholder}
              className="mt-1.5 w-full h-11 rounded-xl border border-slate-300 px-3.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 disabled:bg-slate-100 placeholder:text-slate-400 transition"
            />
          </label>

          {/* Password Input with Show / Hide Toggle & Forgot Password Link */}
          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <Link
                to={forgotPasswordLink}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative mt-1.5">
              <input
                required
                disabled={isSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full h-11 rounded-xl border border-slate-300 pl-3.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 disabled:bg-slate-100 placeholder:text-slate-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 focus:outline-none transition rounded-lg"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {/* Error Message */}
          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60 inline-flex items-center justify-center gap-2 shadow-xs transition"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Signing in…' : `Sign in as ${admin ? 'Administrator' : currentConfig.shortLabel}`}
          </button>
        </form>

        {/* Social Authentication or Compliance Notice */}
        {!admin && (
          <div className="mt-4">
            {roleHint === 'USER' || roleHint === 'AMBULANCE_PROVIDER' ? (
              <SocialAuthButtons roleHint={roleHint} onSuccess={finishLogin} onError={setError} />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-[11px] text-slate-600 font-medium">
                  {roleHint === 'HOSPITAL'
                    ? 'Hospital portal requires verified organizational credentials'
                    : 'Driver portal requires verified operator fleet credentials'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer & Registration Links */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-3">
          <p className="text-xs sm:text-sm text-slate-600">
            Looking for hospitals without signing in?{' '}
            <Link className="font-semibold text-slate-900 hover:underline inline-flex items-center gap-1" to="/search">
              Browse Hospital Directory →
            </Link>
          </p>

          {!admin && (
            <div className="pt-1 space-y-1">
              <p className="text-xs text-slate-600">
                Need a {currentConfig.shortLabel} account?{' '}
                <Link className="font-bold text-blue-600 hover:underline" to={currentConfig.registerPath}>
                  {currentConfig.registerLabel} →
                </Link>
              </p>
              <p className="text-[11px] text-slate-400">
                Need a different role?{' '}
                <Link className="text-slate-600 hover:underline font-medium" to="/register">
                  View all account types
                </Link>
              </p>
            </div>
          )}

          {admin && (
            <p className="text-xs text-slate-500">
              <Link className="text-slate-600 hover:text-slate-950 font-medium" to="/login">
                ← Back to standard role sign in
              </Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
};
