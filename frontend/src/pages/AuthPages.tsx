import { Link, Navigate } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { useAuth } from '../context/AuthContext';
import { ROUTES, getRoleHome } from '../routes/routePaths';

export const AdminLoginPage = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user?.role === 'ADMIN') return <Navigate to={ROUTES.ADMIN.DASHBOARD} replace />;
  return <LoginPage admin />;
};

export const UnauthorizedPage = () => {
  const { user } = useAuth();
  const homePath = user?.role ? getRoleHome(user.role) : ROUTES.PUBLIC.LOGIN;
  const roleTitle = user?.role ? user.role.replaceAll('_', ' ').toLowerCase() : 'account';

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold text-slate-500">No access</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">You cannot open this page</h1>
        <p className="mt-2 text-slate-600">Your {roleTitle} account cannot open this page.</p>
        <Link to={homePath} className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">
          Back to your page
        </Link>
      </section>
    </main>
  );
};
