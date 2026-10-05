import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '../components/navigation/AppHeader';
import { BottomNavigation } from '../components/navigation/BottomNavigation';
import { useLocationState } from '../hooks/useLocationState';

export const AppLayout = () => {
  const { currentLocation, isUpdating, refreshLocation } = useLocationState();
  const location = useLocation();
  const isEmergencyRoute = location.pathname.startsWith('/sos');
  const isRoutePage = location.pathname.startsWith('/route');
  const isAmbulanceRoute = location.pathname.startsWith('/ambulance');

  // Emergency Mode and Route Navigation strip shell headers and bottom nav tabs for full immersion and focus
  if (isEmergencyRoute || isRoutePage || isAmbulanceRoute) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet context={{ currentLocation, refreshLocation, isUpdating }} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Persistent App Header */}
      <AppHeader
        userLocation={currentLocation}
        isUpdatingLocation={isUpdating}
        onRefreshLocation={refreshLocation}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pb-16 md:pb-0 overflow-x-hidden">
        <Outlet context={{ currentLocation, refreshLocation, isUpdating }} />
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};
