import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Navigation,
  LayoutDashboard,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Radio,
  MapPin,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ambulanceDriverApi } from '../services/ambulanceDriverApi';
import { useLocationState } from '../hooks/useLocationState';
import { ROUTES } from '../routes/routePaths';

const driverNavItems = [
  { label: 'Driver Console', path: ROUTES.DRIVER.DASHBOARD, icon: LayoutDashboard },
  { label: 'Dispatch Assignments', path: ROUTES.DRIVER.ASSIGNMENTS, icon: Radio },
  { label: 'Active Navigation', path: ROUTES.DRIVER.NAVIGATION('active'), icon: Navigation },
  { label: 'Trips & Mileage', path: ROUTES.DRIVER.TRIPS, icon: History },
  { label: 'Notifications', path: ROUTES.DRIVER.NOTIFICATIONS, icon: Bell },
  { label: 'Driver Profile', path: ROUTES.DRIVER.PROFILE, icon: User },
  { label: 'Console Settings', path: ROUTES.DRIVER.SETTINGS, icon: Settings },
];

export const DriverLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentLocation, location: currentGeoLocation, isUpdating, permissionState, locationError, refreshLocation } = useLocationState();

  const driverProfile = useQuery({
    queryKey: ['ambulance-driver', 'profile'],
    queryFn: ambulanceDriverApi.getProfile,
  });

  const driverStatus = useQuery({
    queryKey: ['ambulance-driver', 'status'],
    queryFn: ambulanceDriverApi.getStatus,
    refetchInterval: 5000,
  });

  const driverName = driverProfile.data?.fullName || user?.name || 'Driver';
  const isOnDuty = driverStatus.data?.isOnDuty ?? false;
  const vehicle = user?.assignedAmbulanceVehicleNumber || 'Assigned Fleet';

  const currentItem = driverNavItems.find((item) =>
    item.path === ROUTES.DRIVER.DASHBOARD
      ? location.pathname === ROUTES.DRIVER.DASHBOARD
      : location.pathname.startsWith(item.path.split('/active')[0])
  ) ?? driverNavItems[0];

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(ROUTES.PUBLIC.LOGIN, { replace: true });
    }
  };

  const context = {
    currentLocation,
    location: currentGeoLocation,
    permissionState,
    locationError,
    refreshLocation,
    isUpdating,
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        {/* Brand */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 text-indigo-400 border border-indigo-500/20 shadow-xs">
              <Navigation className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-950 text-sm tracking-tight">ResQ Driver</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Paramedic Navigation</p>
            </div>
          </div>
        </div>

        {/* Driver Card & Duty Indicator */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <p className="truncate text-xs font-bold text-slate-900">{driverName}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isOnDuty ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-700'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isOnDuty ? 'bg-emerald-600 animate-pulse' : 'bg-slate-500'}`} />
              {isOnDuty ? 'ON DUTY' : 'OFF DUTY'}
            </span>
            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px]">{vehicle}</span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Driver Navigation">
          {driverNavItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === ROUTES.DRIVER.DASHBOARD}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer info & Logout */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/60">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100"
                aria-label="Toggle Navigation"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div>
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  Ambulance Driver <ChevronRight className="h-3 w-3" /> {currentItem.label}
                </p>
                <h1 className="text-base sm:text-lg font-bold text-slate-950">{currentItem.label}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <MapPin className="h-3.5 w-3.5 text-indigo-600" />
                <span className="font-semibold">{permissionState === 'granted' ? 'GPS Active' : 'GPS Required'}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-slate-200 bg-white px-3 py-3 space-y-1">
              {driverNavItems.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  end={path === ROUTES.DRIVER.DASHBOARD}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                      isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </header>

        {/* View Content */}
        <main className="flex-1 flex flex-col">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
};
