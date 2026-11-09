import { Lock, ArrowLeft, CheckCircle2, Eye, EyeOff, Shield } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';
import { authApi, AuthApiError } from '../../services/authApi';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('This reset link is missing its security token. Please request a new reset link.');
      return;
    }
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof AuthApiError && err.code === 'INVALID_RESET_TOKEN') {
        setError('This reset link is invalid or has expired. Please request a new one.');
      } else {
        setError('We could not update your password right now. Please try again in a moment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const passwordStrength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthColors = ['transparent', '#f43f5e', '#f59e0b', '#10b981'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];

  return (
    <main className="min-h-screen mesh-bg flex items-center justify-center p-6 font-sans">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-md page-enter">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', boxShadow: '0 4px 16px rgba(244,63,94,0.35)' }}
          >
            <Shield className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white">ResQ 2.O</p>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>Identity & Security</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-10"
          style={{
            background: 'rgba(255,255,255,0.025)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.6)',
          }}
        >
          {success ? (
            /* ── Success ── */
            <div className="text-center py-4">
              <div
                className="mx-auto mb-6 h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--emerald-dim)', border: '1px solid rgba(16,185,129,0.20)' }}
              >
                <CheckCircle2 className="h-7 w-7" style={{ color: '#34d399' }} />
              </div>
              <h1 className="text-2xl font-light tracking-tight text-white mb-3">Password Updated</h1>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Your password has been successfully updated. You may now sign in to your role portal.
              </p>
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.PUBLIC.LOGIN)}
                  className="w-full h-12 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                    boxShadow: '0 4px 20px rgba(244,63,94,0.30)',
                  }}
                >
                  Proceed to Sign In
                </button>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="mb-8">
                <div
                  className="mb-5 h-12 w-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.18)' }}
                >
                  <Lock className="h-5 w-5" style={{ color: '#f43f5e' }} />
                </div>
                <h1 className="text-2xl font-light tracking-tight text-white mb-2">Set New Password</h1>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Choose a strong password to secure your ResQ account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error */}
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                    style={{ background: 'var(--crimson-dim)', border: '1px solid rgba(244,63,94,0.20)', color: '#fb7185' }}
                  >
                    {error}
                  </div>
                )}

                {/* New Password */}
                <div className="space-y-2">
                  <label className="overline block">New Password</label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      minLength={8}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="input-dark h-12 w-full px-4 pr-12 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'var(--text-tertiary)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Strength meter */}
                  {password.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3].map(level => (
                          <div
                            key={level}
                            className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{
                              background: passwordStrength >= level ? strengthColors[passwordStrength] : 'rgba(255,255,255,0.08)',
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-semibold" style={{ color: strengthColors[passwordStrength] }}>
                        {strengthLabels[passwordStrength]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="overline block">Confirm New Password</label>
                  <div className="relative">
                    <input
                      required
                      type={showConfirm ? 'text' : 'password'}
                      minLength={8}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="input-dark h-12 w-full px-4 pr-12 text-sm"
                      style={
                        confirmPassword && confirmPassword !== password
                          ? { borderColor: 'rgba(244,63,94,0.40)' }
                          : confirmPassword && confirmPassword === password
                          ? { borderColor: 'rgba(16,185,129,0.40)' }
                          : {}
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'var(--text-tertiary)' }}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword === password && (
                    <p className="text-[11px] font-medium" style={{ color: '#34d399' }}>Passwords match ✓</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !token}
                  className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                  style={{
                    background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                    boxShadow: submitting ? 'none' : '0 4px 20px rgba(244,63,94,0.30)',
                  }}
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Updating…
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>

                <div className="text-center pt-1">
                  <Link
                    to={ROUTES.PUBLIC.LOGIN}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.60)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
          ResQ 2.O · Identity & Security · End-to-end encrypted
        </p>
      </div>
    </main>
  );
};
