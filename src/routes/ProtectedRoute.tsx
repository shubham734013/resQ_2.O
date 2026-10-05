import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

const AuthLoading = () => (
  <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
    <div className="text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
      <p className="text-sm font-medium text-slate-600">Checking your session…</p>
    </div>
  </main>
);

export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <Outlet />;
};

export const RoleRoute = ({ allowedRoles }: { allowedRoles: UserRole[] }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
};
