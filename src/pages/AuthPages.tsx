import { Link, Navigate } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { useAuth } from '../context/AuthContext';

export const AdminLoginPage = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <LoginPage admin />;
};

export const UnauthorizedPage = () => (
  <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
    <section className="max-w-md text-center">
      <p className="text-sm font-semibold text-slate-500">403</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Access denied</h1>
      <p className="mt-2 text-slate-600">Your account is authenticated, but this area is restricted to another ResQ role.</p>
      <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Return to ResQ</Link>
    </section>
  </main>
);
