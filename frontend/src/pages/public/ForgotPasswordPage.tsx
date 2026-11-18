import { KeyRound, ArrowLeft, Mail, CheckCircle2, Shield } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';
import { authApi } from '../../services/authApi';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setSubmitted(true);
    } catch {
      setError('We could not send the reset instructions right now. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen mesh-bg flex items-center justify-center p-6 font-sans">

      {/* Background decorative rings */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[360px] w-[360px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-md page-enter">

        {/* Logo wordmark */}
        <div className="flex items-center gap-3 mb-10">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', boxShadow: '0 4px 16px rgba(244,63,94,0.35)' }}
          >
            <Shield className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white">ResQ 2.O</p>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>Crisis Management Platform</p>
          </div>
        </div>

        {/* Auth Card */}
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
          {submitted ? (
            /* ── Success State ── */
            <div className="text-center py-4">
              <div
                className="mx-auto mb-6 h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--emerald-dim)', border: '1px solid rgba(16,185,129,0.20)' }}
              >
                <CheckCircle2 className="h-7 w-7" style={{ color: '#34d399' }} />
              </div>

              <h1 className="text-2xl font-light tracking-tight text-white mb-3">
                Check your inbox
              </h1>
              <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
                If an account with{' '}
                <span className="font-semibold text-white">{email}</span>{' '}
                exists, you will receive password reset instructions shortly.
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Check your spam folder if you don't see it within a few minutes.
              </p>

              <div className="mt-8">
                <Link
                  to={ROUTES.PUBLIC.LOGIN}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : (
            /* ── Form State ── */
            <>
              {/* Icon + Heading */}
              <div className="mb-8">
                <div
                  className="mb-5 h-12 w-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.18)' }}
                >
                  <KeyRound className="h-5 w-5" style={{ color: '#f43f5e' }} />
                </div>
                <h1 className="text-2xl font-light tracking-tight text-white mb-2">
                  Reset your password
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Enter your registered ResQ email address and we'll transmit a secure recovery link to your inbox.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error Alert */}
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                    style={{
                      background: 'var(--crimson-dim)',
                      border: '1px solid rgba(244,63,94,0.20)',
                      color: '#fb7185',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Email Field */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-tertiary)' }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                      style={{ color: 'var(--text-tertiary)' }}
                    />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="input-dark h-12 w-full pl-11 pr-4 text-sm"
                      style={{ borderRadius: '10px' }}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className="w-full h-12 rounded-xl text-sm font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: submitting || !email.trim()
                      ? 'rgba(244,63,94,0.40)'
                      : 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                    boxShadow: submitting || !email.trim() ? 'none' : '0 4px 20px rgba(244,63,94,0.30)',
                  }}
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Send Recovery Instructions'
                  )}
                </button>

                {/* Back link */}
                <div className="text-center pt-1">
                  <Link
                    to={ROUTES.PUBLIC.LOGIN}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors duration-150"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.70)'; }}
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

        {/* Footer note */}
        <p className="mt-8 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
          ResQ 2.O · Identity & Security · End-to-end encrypted
        </p>
      </div>
    </main>
  );
};
