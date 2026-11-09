import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';
import { ROUTES } from './routePaths';
import { PendingApprovalPage } from '../pages/public/PendingApprovalPage';

export const AuthLoading = () => (
  <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6" aria-busy="true">
    <div className="text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-3 h-9 w-9 rounded-full border-2 border-slate-300 border-t-teal-600 animate-spin" />
      <p className="text-sm font-semibold text-slate-700">Verifying authorized session…</p>
      <p className="mt-1 text-xs text-slate-400">ResQ Healthcare Security Infrastructure</p>
    </div>
  </main>
);

/**
 * Ensures user is authenticated before viewing protected child routes.
 * Preserves the requested destination path so they are redirected back after sign-in.
 */
export const RequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.PUBLIC.LOGIN} replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
};

// Backward-compatible alias
export const ProtectedRoute = RequireAuth;

/**
 * Checks that the authenticated user possesses one of the allowed roles.
 * If unauthorized, redirects to /unauthorized or their own role-specific dashboard.
 */
export const RoleRoute = ({ allowedRoles }: { allowedRoles: UserRole[] }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.PUBLIC.LOGIN} replace state={{ from: location.pathname + location.search }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ROUTES.PUBLIC.UNAUTHORIZED} replace state={{ from: location.pathname, userRole: user.role }} />;
  }

  return <Outlet />;
};

/**
 * Enforces account operational approval status.
 * Unapproved (PENDING, REJECTED, SUSPENDED) operational accounts are blocked
 * from accessing live hospital/provider/driver operations and presented with the Pending Approval UI.
 */
export const AccountStatusGuard = ({ allowPending = false }: { allowPending?: boolean } = {}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <AuthLoading />;
  if (!user) return <Navigate to={ROUTES.PUBLIC.LOGIN} replace />;

  // Citizen USER accounts do not require admin license verification
  if (user.role === 'USER') {
    if (user.accountStatus === 'SUSPENDED') {
      return <PendingApprovalPage status="SUSPENDED" />;
    }
    return <Outlet />;
  }

  // Administrators always have operational access
  if (user.role === 'ADMIN') {
    return <Outlet />;
  }

  // Operational roles (HOSPITAL, AMBULANCE_PROVIDER, AMBULANCE_DRIVER)
  if (user.accountStatus === 'PENDING' && !allowPending) {
    return <PendingApprovalPage status="PENDING" />;
  }

  if (user.accountStatus === 'REJECTED') {
    return <PendingApprovalPage status="REJECTED" />;
  }

  if (user.accountStatus === 'SUSPENDED') {
    return <PendingApprovalPage status="SUSPENDED" />;
  }

  return <Outlet />;
};
