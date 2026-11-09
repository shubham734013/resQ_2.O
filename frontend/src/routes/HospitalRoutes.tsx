import { Navigate, Route } from 'react-router-dom';
import { RequireAuth, RoleRoute, AccountStatusGuard } from './ProtectedRoute';
import { HospitalLayout } from '../layouts/HospitalLayout';
import { HospitalPage } from '../pages/HospitalPage';
import { HospitalAppointmentsPage } from '../pages/HospitalAppointmentsPage';
import { HospitalAnalyticsPage } from '../pages/hospital/HospitalAnalyticsPage';
import { HospitalSettingsPage } from '../pages/hospital/HospitalSettingsPage';
import { HospitalDashboardPage } from '../pages/hospital/HospitalDashboardPage';

export const hospitalRoutes = (
  <Route path="/hospital" element={<RequireAuth />}>
    <Route element={<RoleRoute allowedRoles={['HOSPITAL']} />}>
      <Route element={<AccountStatusGuard />}>
        <Route element={<HospitalLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<HospitalDashboardPage />} />
          <Route path="requests" element={<HospitalPage tab="requests" />} />
          <Route path="requests/:requestId" element={<HospitalPage tab="requests" />} />
          <Route path="care-requests" element={<HospitalAppointmentsPage initialSubTab="requests" />} />
          <Route path="care-requests/:requestId" element={<HospitalAppointmentsPage initialSubTab="requests" />} />
          <Route path="emergencies" element={<Navigate to="/hospital/requests" replace />} />
          <Route path="appointments" element={<HospitalAppointmentsPage initialSubTab="appointments" />} />
          <Route path="appointments/:appointmentId" element={<HospitalAppointmentsPage initialSubTab="appointments" />} />
          <Route path="emergency" element={<HospitalPage tab="emergency" />} />
          <Route path="patients" element={<HospitalPage tab="patients" />} />
          <Route path="services" element={<HospitalPage tab="services" />} />
          <Route path="availability" element={<HospitalPage tab="availability" />} />
          <Route path="resources" element={<Navigate to="/hospital/availability" replace />} />
          <Route path="ambulances" element={<HospitalPage tab="ambulances" />} />
          <Route path="analytics" element={<HospitalAnalyticsPage />} />
          <Route path="notifications" element={<Navigate to="/hospital/requests" replace />} />
          <Route path="profile" element={<HospitalPage tab="profile" />} />
          <Route path="settings" element={<HospitalSettingsPage />} />
        </Route>
      </Route>
    </Route>
  </Route>
);
