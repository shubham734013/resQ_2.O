import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  LayoutDashboard,
  Building2,
  Calendar,
  AlertTriangle,
  Ambulance,
  History,
  Bell,
  User,
  Settings,
  LogOut,
  MapPin,
  RefreshCw,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocationState } from '../hooks/useLocationState';
import { ROUTES } from '../routes/routePaths';
import { StatusBadge } from '../components/common/StatusBadge';

const userNavItems = [
  { label: 'Citizen Dashboard', path: ROUTES.USER.DASHBOARD, icon: LayoutDashboard },
  { label: 'Nearby Hospitals', path: ROUTES.USER.HOSPITALS, icon: Building2 },
  { label: 'Appointments & Care', path: ROUTES.USER.APPOINTMENTS, icon: Calendar },
  { label: 'Emergency SOS', path: ROUTES.USER.EMERGENCY, icon: AlertTriangle, isEmergency: true },
  { label: 'Ambulances & Fleet', path: ROUTES.USER.AMBULANCES, icon: Ambulance },
  { label: 'History & Bookings', path: ROUTES.USER.HISTORY, icon: History },
  { label: 'Notifications', path: ROUTES.USER.NOTIFICATIONS, icon: Bell },
  { label: 'My Profile', path: ROUTES.USER.PROFILE, icon: User },
  { label: 'Account Settings', path: ROUTES.USER.SETTINGS, icon: Settings },
];

export const UserLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLocation, location: currentGeoLocation, isUpdating, permissionState, locationError, refreshLocation } = useLocationState();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentItem = userNavItems.find((item) =>
    item.path === ROUTES.USER.DASHBOARD
      ? location.pathname === ROUTES.USER.DASHBOARD
      : location.pathname.startsWith(item.path)
  ) ?? userNavItems[0];

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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-teal-950 text-teal-400 border border-teal-500/20 shadow-xs">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-950 text-sm tracking-tight">ResQ Citizen</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Healthcare Navigation</p>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <p className="truncate text-xs font-bold text-slate-900">{user?.name || user?.email || 'Citizen User'}</p>
          <div className="mt-1 flex items-center justify-between">
            <StatusBadge variant="verified" label="Citizen Account" />
            <button
              type="button"
              onClick={refreshLocation}
              disabled={isUpdating}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
              title="Refresh GPS"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isUpdating ? 'animate-spin' : ''}`} />
              GPS
            </button>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Citizen Navigation">
          {userNavItems.map(({ label, path, icon: Icon, isEmergency }) => (
            <NavLink
              key={path}
              to={path}
              end={path === ROUTES.USER.DASHBOARD}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  isEmergency
                    ? isActive
                      ? 'bg-rose-600 text-white shadow-xs shadow-rose-600/30'
                      : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-200/80 font-bold'
                    : isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className={`h-4 w-4 shrink-0 ${isEmergency ? (location.pathname.startsWith(path) ? 'text-white' : 'text-rose-600') : ''}`} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout & Footer */}
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
        {/* Top Header */}
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
                  Citizen Portal <ChevronRight className="h-3 w-3" /> {currentItem.label}
                </p>
                <h1 className="text-base sm:text-lg font-bold text-slate-950">{currentItem.label}</h1>
              </div>
            </div>

            {/* Right Header Controls */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <MapPin className="h-3.5 w-3.5 text-teal-600" />
                <span className="font-semibold truncate max-w-[150px]">{currentLocation.label || 'Jaipur'}</span>
              </div>

              <NavLink
                to={ROUTES.USER.EMERGENCY}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>SOS</span>
              </NavLink>

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
              {userNavItems.map(({ label, path, icon: Icon, isEmergency }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  end={path === ROUTES.USER.DASHBOARD}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                      isEmergency
                        ? 'bg-rose-50 text-rose-900 border border-rose-200'
                        : isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-50'
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

        {/* Nested View */}
        <main className="flex-1 flex flex-col">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
};
