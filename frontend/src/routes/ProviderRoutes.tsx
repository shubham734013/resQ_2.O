import { Navigate, Route } from 'react-router-dom';
import { RequireAuth, RoleRoute, AccountStatusGuard } from './ProtectedRoute';
import { ProviderLayout } from '../layouts/ProviderLayout';
import { AmbulanceProviderDashboardPage } from '../pages/AmbulanceProviderDashboardPage';
import { ProviderDispatchPage } from '../pages/provider/ProviderDispatchPage';
import { ProviderAnalyticsPage } from '../pages/provider/ProviderAnalyticsPage';
import { ProviderNotificationsPage } from '../pages/provider/ProviderNotificationsPage';
import { ProviderSettingsPage } from '../pages/provider/ProviderSettingsPage';

export const providerRoutes = (
  <Route path="/provider" element={<RequireAuth />}>
    <Route element={<RoleRoute allowedRoles={['AMBULANCE_PROVIDER']} />}>
      <Route element={<AccountStatusGuard />}>
        <Route element={<ProviderLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AmbulanceProviderDashboardPage initialSection="overview" />} />
          <Route path="ambulances" element={<AmbulanceProviderDashboardPage initialSection="ambulances" />} />
          <Route path="ambulances/:ambulanceId" element={<AmbulanceProviderDashboardPage initialSection="ambulances" />} />
          <Route path="drivers" element={<AmbulanceProviderDashboardPage initialSection="drivers" />} />
          <Route path="drivers/:driverId" element={<AmbulanceProviderDashboardPage initialSection="drivers" />} />
          <Route path="requests" element={<AmbulanceProviderDashboardPage initialSection="requests" />} />
          <Route path="requests/:requestId" element={<AmbulanceProviderDashboardPage initialSection="requests" />} />
          <Route path="dispatch" element={<ProviderDispatchPage />} />
          <Route path="trips" element={<AmbulanceProviderDashboardPage initialSection="trips" />} />
          <Route path="trips/:tripId" element={<AmbulanceProviderDashboardPage initialSection="trips" />} />
          <Route path="analytics" element={<ProviderAnalyticsPage />} />
          <Route path="notifications" element={<ProviderNotificationsPage />} />
          <Route path="profile" element={<AmbulanceProviderDashboardPage initialSection="profile" />} />
          <Route path="settings" element={<ProviderSettingsPage />} />
        </Route>
      </Route>
    </Route>
  </Route>
);
