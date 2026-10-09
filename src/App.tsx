import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, RoleRoute } from './routes/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { HospitalLayout } from './components/hospital/HospitalLayout';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { SavedPage } from './pages/SavedPage';
import { ProfilePage } from './pages/ProfilePage';
import { EmergencyPage } from './pages/EmergencyPage';
import { FacilityDetailPage } from './pages/FacilityDetailPage';
import { RouteNavigationPage } from './pages/RouteNavigationPage';
import { HospitalPage } from './pages/HospitalPage';
import { AmbulancePage } from './pages/AmbulancePage';
import { AdminLoginPage, UnauthorizedPage } from './pages/AuthPages';
import { LoginPage } from './pages/LoginPage';
import { RegistrationPage, RegistrationRoleSelect } from './pages/RegistrationPage';
import { AmbulanceProviderDashboardPage } from './pages/AmbulanceProviderDashboardPage';
import { AdminOverviewPage, AdminEmergenciesPage, AdminReportsPage, AdminAnalyticsPage, AdminSettingsPage } from './pages/AdminPage';
import { AdminUsersManagementPage, AdminHospitalsManagementPage, AdminProvidersManagementPage, AdminAmbulancesManagementPage, AdminDriversManagementPage } from './pages/AdminManagementPages';
import { AdminUserDetailPage, AdminHospitalDetailPage, AdminProviderDetailPage, AdminAmbulanceDetailPage, AdminDriverDetailPage } from './pages/AdminDetailPages';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false, retry: 1 } } });

export function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route path="/register" element={<RegistrationRoleSelect />} />
    <Route path="/register/user" element={<RegistrationPage kind="user" />} />
    <Route path="/hospital/register" element={<RegistrationPage kind="hospital" />} />
    <Route path="/ambulance-provider/register" element={<RegistrationPage kind="ambulance-provider" />} />
    <Route path="/ambulance-driver/register" element={<RegistrationPage kind="ambulance-driver" />} />
    <Route path="/unauthorized" element={<UnauthorizedPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<RoleRoute allowedRoles={['USER']} />}><Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} /><Route path="/search" element={<SearchPage />} /><Route path="/facility/:id" element={<FacilityDetailPage />} /><Route path="/route/:facilityId" element={<RouteNavigationPage />} /><Route path="/saved" element={<SavedPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/sos" element={<EmergencyPage />} />
      </Route></Route>
      <Route element={<RoleRoute allowedRoles={['HOSPITAL']} />}><Route path="/hospital" element={<HospitalLayout />}><Route index element={<HospitalPage />} /><Route path="emergencies" element={<HospitalPage />} /><Route path="patients" element={<HospitalPage />} /><Route path="ambulances" element={<HospitalPage />} /><Route path="resources" element={<HospitalPage />} /><Route path="profile" element={<HospitalPage />} /></Route></Route>
      <Route element={<RoleRoute allowedRoles={['AMBULANCE_DRIVER']} />}><Route path="/ambulance/*" element={<AmbulancePage />} /></Route>
      <Route element={<RoleRoute allowedRoles={['AMBULANCE_PROVIDER']} />}><Route path="/ambulance-provider/*" element={<AmbulanceProviderDashboardPage />} /><Route path="/ambulance/provider" element={<AmbulanceProviderDashboardPage />} /></Route>
      <Route element={<RoleRoute allowedRoles={['ADMIN']} />}>
        <Route path="/admin" element={<AdminOverviewPage />} /><Route path="/admin/emergencies" element={<AdminEmergenciesPage />} /><Route path="/admin/hospitals" element={<AdminHospitalsManagementPage />} /><Route path="/admin/hospitals/:id" element={<AdminHospitalDetailPage />} /><Route path="/admin/ambulances" element={<AdminAmbulancesManagementPage />} /><Route path="/admin/ambulances/:id" element={<AdminAmbulanceDetailPage />} /><Route path="/admin/users" element={<AdminUsersManagementPage />} /><Route path="/admin/users/:id" element={<AdminUserDetailPage />} /><Route path="/admin/providers" element={<AdminProvidersManagementPage />} /><Route path="/admin/providers/:id" element={<AdminProviderDetailPage />} /><Route path="/admin/drivers" element={<AdminDriversManagementPage />} /><Route path="/admin/drivers/:id" element={<AdminDriverDetailPage />} /><Route path="/admin/reports" element={<AdminReportsPage />} /><Route path="/admin/analytics" element={<AdminAnalyticsPage />} /><Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter></QueryClientProvider>;
}
export default App;
