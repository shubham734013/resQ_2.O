import { Navigate, Route } from 'react-router-dom';
import { RequireAuth, RoleRoute } from './ProtectedRoute';
import { AdminLayout } from '../layouts/AdminLayout';
import {
  AdminOverviewPage,
  AdminEmergenciesPage,
  AdminReportsPage,
  AdminAnalyticsPage,
  AdminSettingsPage,
} from '../pages/AdminPage';
import {
  AdminUsersManagementPage,
  AdminHospitalsManagementPage,
  AdminProvidersManagementPage,
  AdminAmbulancesManagementPage,
  AdminDriversManagementPage,
} from '../pages/AdminManagementPages';
import {
  AdminUserDetailPage,
  AdminHospitalDetailPage,
  AdminProviderDetailPage,
  AdminAmbulanceDetailPage,
  AdminDriverDetailPage,
} from '../pages/AdminDetailPages';
import { AdminAppointmentsPage } from '../pages/admin/AdminAppointmentsPage';

export const adminRoutes = (
  <Route path="/admin" element={<RequireAuth />}>
    <Route element={<RoleRoute allowedRoles={['ADMIN']} />}>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUsersManagementPage />} />
        <Route path="users/:id" element={<AdminUserDetailPage />} />
        <Route path="hospitals" element={<AdminHospitalsManagementPage />} />
        <Route path="hospitals/:id" element={<AdminHospitalDetailPage />} />
        <Route path="providers" element={<AdminProvidersManagementPage />} />
        <Route path="providers/:id" element={<AdminProviderDetailPage />} />
        <Route path="drivers" element={<AdminDriversManagementPage />} />
        <Route path="drivers/:id" element={<AdminDriverDetailPage />} />
        <Route path="ambulances" element={<AdminAmbulancesManagementPage />} />
        <Route path="ambulances/:id" element={<AdminAmbulanceDetailPage />} />
        <Route path="requests" element={<AdminEmergenciesPage />} />
        <Route path="emergencies" element={<AdminEmergenciesPage />} />
        <Route path="appointments" element={<AdminAppointmentsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="audit-logs" element={<AdminReportsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>
    </Route>
  </Route>
);
