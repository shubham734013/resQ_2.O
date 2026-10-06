import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '../components/navigation/AppHeader';
import { BottomNavigation } from '../components/navigation/BottomNavigation';
import { useLocationState } from '../hooks/useLocationState';

export const AppLayout = () => {
  const { currentLocation, location: currentGeoLocation, isUpdating, permissionState, locationError, refreshLocation } = useLocationState();
  const routeLocation = useLocation();

  const isEmergencyRoute = routeLocation.pathname.startsWith('/sos');
  const isRoutePage = routeLocation.pathname.startsWith('/route');
  const isAmbulanceRoute = routeLocation.pathname.startsWith('/ambulance');
  const isAdminRoute = routeLocation.pathname.startsWith('/admin');

  const context = {
    currentLocation,
    location: currentGeoLocation,
    permissionState,
    locationError,
    refreshLocation,
    isUpdating,
  };

  if (isEmergencyRoute || isRoutePage || isAmbulanceRoute || isAdminRoute) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet context={context} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      <AppHeader userLocation={currentLocation} isUpdatingLocation={isUpdating} onRefreshLocation={refreshLocation} />
      <main className="flex-1 flex flex-col pb-16 md:pb-0 overflow-x-hidden">
        <Outlet context={context} />
      </main>
      <BottomNavigation />
    </div>
  );
};