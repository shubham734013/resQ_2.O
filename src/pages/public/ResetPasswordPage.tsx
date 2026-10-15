import { Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ROUTES } from '../../routes/routePaths';

export const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSuccess(true);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 border border-teal-100">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-950">Set New Password</h1>
            <p className="text-xs text-slate-500">Security Credentials Update</p>
          </div>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-950">Password Updated</h2>
            <p className="mt-2 text-sm text-slate-600">
              Your password has been successfully updated. You may now sign in to your role portal.
            </p>
            <div className="mt-6">
              <Button variant="primary" onClick={() => navigate(ROUTES.PUBLIC.LOGIN)}>
                Proceed to Sign In
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {error}
              </div>
            )}

            <label className="block text-xs font-semibold text-slate-700">
              New Password
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-teal-600 outline-none"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Confirm New Password
              <input
                required
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-teal-600 outline-none"
              />
            </label>

            <Button type="submit" variant="primary" className="w-full">
              Update Password
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
