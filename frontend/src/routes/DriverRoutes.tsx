import { Navigate, Route } from 'react-router-dom';
import { RequireAuth, RoleRoute, AccountStatusGuard } from './ProtectedRoute';
import { DriverLayout } from '../layouts/DriverLayout';
import { AmbulancePage } from '../pages/AmbulancePage';
import { DriverDashboardPage } from '../pages/driver/DriverDashboardPage';
import { DriverNotificationsPage } from '../pages/driver/DriverNotificationsPage';
import { DriverProfilePage } from '../pages/driver/DriverProfilePage';
import { DriverSettingsPage } from '../pages/driver/DriverSettingsPage';

export const driverRoutes = (
  <Route path="/driver" element={<RequireAuth />}>
    <Route element={<RoleRoute allowedRoles={['AMBULANCE_DRIVER']} />}>
      <Route element={<AccountStatusGuard />}>
        <Route element={<DriverLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DriverDashboardPage />} />
          <Route path="assignments" element={<AmbulancePage mode="request" />} />
          <Route path="assignments/:assignmentId" element={<AmbulancePage mode="request" />} />
          <Route path="navigation" element={<AmbulancePage mode="navigation" />} />
          <Route path="navigation/:assignmentId" element={<AmbulancePage mode="navigation" />} />
          <Route path="trips" element={<AmbulancePage mode="trips" />} />
          <Route path="trips/:tripId" element={<AmbulancePage mode="trips" />} />
          <Route path="notifications" element={<DriverNotificationsPage />} />
          <Route path="profile" element={<DriverProfilePage />} />
          <Route path="settings" element={<DriverSettingsPage />} />
        </Route>
      </Route>
    </Route>
  </Route>
);
