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
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (
    isEmergencyRoute ||
    isRoutePage ||
    isAmbulanceRoute ||
    isAdminRoute
  ) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet
            context={{
              currentLocation,
              refreshLocation,
              isUpdating,
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      <AppHeader
        userLocation={currentLocation}
        isUpdatingLocation={isUpdating}
        onRefreshLocation={refreshLocation}
      />

      <main className="flex-1 flex flex-col pb-16 md:pb-0 overflow-x-hidden">
        <Outlet
          context={{
            currentLocation,
            refreshLocation,
            isUpdating,
          }}
        />
      </main>

      <BottomNavigation />
    </div>
  );
};