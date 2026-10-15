import { KeyRound, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ROUTES } from '../../routes/routePaths';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 border border-teal-100">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-950">Reset your password</h1>
            <p className="text-xs text-slate-500">ResQ Identity & Security</p>
          </div>
        </div>

        {submitted ? (
          <div className="text-center py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-950">Instructions Sent</h2>
            <p className="mt-2 text-sm text-slate-600">
              If an account with email <strong className="text-slate-900">{email}</strong> exists, you will receive password reset instructions shortly.
            </p>
            <div className="mt-6">
              <Link
                to={ROUTES.PUBLIC.LOGIN}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white"
              >
                Return to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your registered ResQ email address. We will verify your account and transmit a secure recovery link.
            </p>

            <label className="block text-xs font-semibold text-slate-700">
              Email Address
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm focus:border-teal-600 outline-none"
                />
              </div>
            </label>

            <Button type="submit" variant="primary" className="w-full">
              Send Recovery Instructions
            </Button>

            <div className="text-center pt-2">
              <Link to={ROUTES.PUBLIC.LOGIN} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
};
