import { Navigate, Route } from 'react-router-dom';
import { RequireAuth, RoleRoute, AccountStatusGuard } from './ProtectedRoute';
import { UserLayout } from '../layouts/UserLayout';
import { UserDashboardPage } from '../pages/user/UserDashboardPage';
import { SearchPage } from '../pages/SearchPage';
import { FacilityDetailPage } from '../pages/FacilityDetailPage';
import { CitizenAppointmentsPage } from '../pages/CitizenAppointmentsPage';
import { EmergencyPage } from '../pages/EmergencyPage';
import { UserAmbulancesPage } from '../pages/user/UserAmbulancesPage';
import { UserTrackingPage } from '../pages/user/UserTrackingPage';
import { UserNotificationsPage } from '../pages/user/UserNotificationsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { UserSettingsPage } from '../pages/user/UserSettingsPage';
import { RouteNavigationPage } from '../pages/RouteNavigationPage';
import { SavedPage } from '../pages/SavedPage';

export const userRoutes = (
  <Route path="/user" element={<RequireAuth />}>
    <Route element={<RoleRoute allowedRoles={['USER']} />}>
      <Route element={<AccountStatusGuard />}>
        <Route element={<UserLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<UserDashboardPage />} />
          <Route path="hospitals" element={<SearchPage />} />
          <Route path="hospitals/:id" element={<FacilityDetailPage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="route" element={<RouteNavigationPage />} />
          <Route path="route/:facilityId" element={<RouteNavigationPage />} />
          <Route path="appointments" element={<CitizenAppointmentsPage />} />
          <Route path="appointments/:appointmentId" element={<CitizenAppointmentsPage />} />
          <Route path="emergency" element={<EmergencyPage />} />
          <Route path="emergency/:requestId" element={<EmergencyPage />} />
          <Route path="ambulances" element={<UserAmbulancesPage />} />
          <Route path="tracking/:requestId" element={<UserTrackingPage />} />
          <Route path="history" element={<CitizenAppointmentsPage />} />
          <Route path="notifications" element={<UserNotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<UserSettingsPage />} />
        </Route>
      </Route>
    </Route>
  </Route>
);
