/* eslint-disable react-refresh/only-export-components */
import { Navigate, Route, useParams } from 'react-router-dom';

const FacilityRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/user/hospitals/${id}` : '/user/hospitals'} replace />;
};

const RouteRedirect = () => {
  const { facilityId } = useParams<{ facilityId: string }>();
  return <Navigate to={facilityId ? `/user/route/${facilityId}` : '/user/route'} replace />;
};

export const compatibilityRedirectRoutes = (
  <>
    {/* Legacy Citizen Routes */}
    <Route path="/sos" element={<Navigate to="/user/emergency" replace />} />
    <Route path="/appointments" element={<Navigate to="/user/appointments" replace />} />
    <Route path="/my-requests" element={<Navigate to="/user/appointments" replace />} />
    <Route path="/search" element={<Navigate to="/user/hospitals" replace />} />
    <Route path="/facility/:id" element={<FacilityRedirect />} />
    <Route path="/route" element={<Navigate to="/user/route" replace />} />
    <Route path="/route/:facilityId" element={<RouteRedirect />} />
    <Route path="/saved" element={<Navigate to="/user/saved" replace />} />
    <Route path="/profile" element={<Navigate to="/user/profile" replace />} />

    {/* Legacy Ambulance Provider Routes */}
    <Route path="/ambulance/provider" element={<Navigate to="/provider/dashboard" replace />} />
    <Route path="/ambulance-provider" element={<Navigate to="/provider/dashboard" replace />} />
    <Route path="/ambulance-provider/*" element={<Navigate to="/provider/dashboard" replace />} />

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
