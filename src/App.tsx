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

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false, retry: 1 } } });

export function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/facility/:id" element={<FacilityDetailPage />} />
      <Route path="/route/:facilityId" element={<RouteNavigationPage />} />
      <Route path="/saved" element={<SavedPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/sos" element={<EmergencyPage />} />
    </Route>
    <Route path="/hospital" element={<HospitalLayout />}>
      <Route index element={<HospitalPage />} />
      <Route path="emergencies" element={<HospitalPage />} />
      <Route path="patients" element={<HospitalPage />} />
      <Route path="ambulances" element={<HospitalPage />} />
      <Route path="resources" element={<HospitalPage />} />
      <Route path="profile" element={<HospitalPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></QueryClientProvider>;
}
export default App;
