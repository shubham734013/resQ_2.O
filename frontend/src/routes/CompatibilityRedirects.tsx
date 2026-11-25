/* eslint-disable react-refresh/only-export-components */
import { Navigate, Route, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOMES, ROUTES } from './routePaths';
import { AuthLoading } from './ProtectedRoute';

const FacilityRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/user/hospitals/${id}` : '/user/hospitals'} replace />;
};

const RouteRedirect = () => {
  const { facilityId } = useParams<{ facilityId: string }>();
  return <Navigate to={facilityId ? `/user/route/${facilityId}` : '/user/route'} replace />;
};

const DashboardRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.PUBLIC.LOGIN} replace state={{ from: '/dashboard' }} />;
  }
  return <Navigate to={ROLE_HOMES[user.role] || ROUTES.USER.DASHBOARD} replace />;
};

const SosRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  if (isAuthenticated && user) {
    if (user.role === 'HOSPITAL') return <Navigate to={ROUTES.HOSPITAL.DASHBOARD} replace />;
    if (user.role === 'AMBULANCE_DRIVER') return <Navigate to={ROUTES.DRIVER.DASHBOARD} replace />;
    if (user.role === 'ADMIN') return <Navigate to={ROUTES.ADMIN.DASHBOARD} replace />;
  }
  return <Navigate to={ROUTES.USER.EMERGENCY} replace />;
};

const AppointmentsRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  if (isAuthenticated && user) {
    if (user.role === 'HOSPITAL') return <Navigate to={ROUTES.HOSPITAL.APPOINTMENTS} replace />;
    if (user.role === 'ADMIN') return <Navigate to={ROUTES.ADMIN.APPOINTMENTS} replace />;
  }
  return <Navigate to={ROUTES.USER.APPOINTMENTS} replace />;
};

const ProfileRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  if (isAuthenticated && user) {
    if (user.role === 'HOSPITAL') return <Navigate to={ROUTES.HOSPITAL.PROFILE} replace />;
    if (user.role === 'AMBULANCE_DRIVER') return <Navigate to={ROUTES.DRIVER.PROFILE} replace />;
    if (user.role === 'ADMIN') return <Navigate to={ROUTES.ADMIN.DASHBOARD} replace />;
  }
  return <Navigate to={ROUTES.USER.PROFILE} replace />;
};

export const compatibilityRedirectRoutes = (
  <>
    {/* Role-Aware Dynamic Redirects */}
    <Route path="/dashboard" element={<DashboardRedirect />} />
    <Route path="/sos" element={<SosRedirect />} />
    <Route path="/emergency" element={<SosRedirect />} />
    <Route path="/emergency/:requestId" element={<SosRedirect />} />
    <Route path="/appointments" element={<AppointmentsRedirect />} />
    <Route path="/my-requests" element={<AppointmentsRedirect />} />
    <Route path="/search" element={<Navigate to="/user/hospitals" replace />} />
    <Route path="/facility/:id" element={<FacilityRedirect />} />
    <Route path="/route" element={<Navigate to="/user/route" replace />} />
    <Route path="/route/:facilityId" element={<RouteRedirect />} />
    <Route path="/saved" element={<Navigate to="/user/saved" replace />} />
    <Route path="/profile" element={<ProfileRedirect />} />

    {/* Legacy Ambulance Provider Routes -> reroute cleanly to driver dashboard */}
    <Route path="/ambulance/provider" element={<Navigate to="/driver/dashboard" replace />} />
    <Route path="/ambulance-provider" element={<Navigate to="/driver/dashboard" replace />} />
    <Route path="/ambulance-provider/*" element={<Navigate to="/driver/dashboard" replace />} />

    {/* Legacy Ambulance Driver Routes */}
    <Route path="/ambulance" element={<Navigate to="/driver/dashboard" replace />} />
    <Route path="/ambulance/requests" element={<Navigate to="/driver/assignments" replace />} />
    <Route path="/ambulance/navigation" element={<Navigate to="/driver/navigation/active" replace />} />
    <Route path="/ambulance/trip" element={<Navigate to="/driver/trips" replace />} />
    <Route path="/ambulance/trips" element={<Navigate to="/driver/trips" replace />} />
    <Route path="/ambulance/profile" element={<Navigate to="/driver/profile" replace />} />
    <Route path="/ambulance/*" element={<Navigate to="/driver/dashboard" replace />} />
  </>
);
