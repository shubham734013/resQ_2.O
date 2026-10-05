import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import {
  AdminOverviewPage,
  AdminEmergenciesPage,
  AdminHospitalsPage,
  AdminAmbulancesPage,
  AdminUsersPage,
  AdminReportsPage,
  AdminAnalyticsPage,
  AdminSettingsPage,
} from './pages/AdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* User */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/facility/:id" element={<FacilityDetailPage />} />
            <Route path="/route/:facilityId" element={<RouteNavigationPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/sos" element={<EmergencyPage />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminOverviewPage />} />
            <Route path="/admin/emergencies" element={<AdminEmergenciesPage />} />
            <Route path="/admin/hospitals" element={<AdminHospitalsPage />} />
            <Route path="/admin/ambulances" element={<AdminAmbulancesPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
          </Route>

          {/* Hospital */}
          <Route path="/hospital" element={<HospitalLayout />}>
            <Route index element={<HospitalPage />} />
            <Route path="emergencies" element={<HospitalPage />} />
            <Route path="patients" element={<HospitalPage />} />
            <Route path="ambulances" element={<HospitalPage />} />
            <Route path="resources" element={<HospitalPage />} />
            <Route path="profile" element={<HospitalPage />} />
          </Route>

          {/* Ambulance */}
          <Route path="/ambulance/*" element={<AmbulancePage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;