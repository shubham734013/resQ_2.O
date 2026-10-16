import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  AlertTriangle,
  Ambulance,
  History,
  Bell,
  User,
  LogOut,
  MapPin,
  Menu,
  X,
  Heart,
  Bookmark,
  Search,
  ChevronDown,
  HeartPulse,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocationState } from '../hooks/useLocationState';
import { ROUTES } from '../routes/routePaths';

// ─── Nav items matching the reference image ────────────────────────────────
const userNavItems = [
  { label: 'Home', path: ROUTES.USER.DASHBOARD, icon: LayoutDashboard },
  { label: 'SOS Emergency', path: ROUTES.USER.EMERGENCY, icon: AlertTriangle, isEmergency: true },
  { label: 'Find Ambulance', path: ROUTES.USER.AMBULANCES, icon: Ambulance },
  { label: 'Nearby Hospitals', path: ROUTES.USER.HOSPITALS, icon: Building2 },
  { label: 'Book Appointment', path: ROUTES.USER.APPOINTMENTS, icon: Calendar },
  { label: 'Health Services', path: ROUTES.USER.HOSPITALS, icon: Heart },
  { label: 'My Requests', path: ROUTES.USER.HISTORY, icon: History },
  { label: 'Saved Locations', path: ROUTES.USER.SAVED, icon: Bookmark },
  { label: 'Notifications', path: ROUTES.USER.NOTIFICATIONS, icon: Bell, badge: 3 },
  { label: 'Profile', path: ROUTES.USER.PROFILE, icon: User },
];

export const UserLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { currentLocation, isUpdating, refreshLocation } = useLocationState();
  const [mobileOpen, setMobileOpen] = useState(false);


  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(ROUTES.PUBLIC.LOGIN, { replace: true });
    }
  };

  const cityLabel = currentLocation.label?.split(',')[0]?.trim() || 'Jaipur';
  const stateLabel = currentLocation.label?.split(',')[1]?.trim() || 'Rajasthan';

  const sidebarContent = (
    <>
      {/* Brand ─────────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-700 shadow-sm">
          <HeartPulse className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-base font-black text-slate-950 tracking-tight leading-none">ResQ</p>
          <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Faster Help. Safer Tomorrow.</p>
        </div>
      </div>

      {/* Nav items ─────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5" aria-label="Citizen Navigation">
        {userNavItems.map(({ label, path, icon: Icon, isEmergency, badge }) => (
          <NavLink
            key={`${path}-${label}`}
            to={path}
            end={path === ROUTES.USER.DASHBOARD}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? isEmergency
                    ? 'bg-rose-600 text-white font-bold shadow-sm'
                    : 'bg-blue-50 text-blue-700 font-semibold border border-blue-100'
                  : isEmergency
                  ? 'text-rose-700 hover:bg-rose-50'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon className="h-4.5 w-4.5 shrink-0 h-[18px] w-[18px]" />
            <span className="flex-1">{label}</span>
            {badge != null && badge > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Emergency? + SOS button ────────────────────────────── */}
      <div className="border-t border-slate-100 p-4 space-y-3">
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
          <p className="text-xs font-bold text-rose-900">Emergency?</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Tap SOS for immediate help</p>
        </div>
        <Link
          to={ROUTES.USER.EMERGENCY}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-rose-600 py-3 text-sm font-black text-white shadow-lg shadow-rose-600/30 hover:bg-rose-700 active:scale-95 transition-all"
          onClick={() => setMobileOpen(false)}
        >
          <Phone className="h-4 w-4" />
          SOS
        </Link>
        <p className="text-center text-[10px] text-slate-400 font-medium">Get help in seconds</p>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700 transition"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        {sidebarContent}
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="lg:pl-56 flex flex-col min-h-screen">
        {/* ── Top Header ─────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/98 backdrop-blur-sm">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Mobile brand */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600">
                <HeartPulse className="h-4 w-4 text-white" />
              </div>
              <span className="font-black text-slate-900 text-sm">ResQ</span>
            </div>

            {/* Location pill */}
            <button
              type="button"
              onClick={refreshLocation}
              disabled={isUpdating}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition min-w-0"
            >
              <MapPin className="h-3.5 w-3.5 text-rose-600 shrink-0" />
              <span className="truncate max-w-[120px]">{cityLabel}, {stateLabel}</span>
              {isUpdating ? (
                <RefreshCw className="h-3 w-3 animate-spin text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
              )}
            </button>

            {/* Search bar */}
            <div className="flex-1 hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 max-w-md">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search hospitals, areas, or services..."
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none min-w-0"
                readOnly
                onClick={() => navigate(ROUTES.USER.HOSPITALS)}
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* Notification bell */}
              <NavLink
                to={ROUTES.USER.NOTIFICATIONS}
                className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" />
              </NavLink>

              {/* User avatar + name */}
              <NavLink
                to={ROUTES.USER.PROFILE}
                className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 hover:bg-slate-50 transition"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-black shrink-0">
                  {(user?.name ?? user?.email ?? 'U').charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-slate-900 leading-none">{user?.name || user?.email || 'Citizen'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">User</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </NavLink>
            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-slate-200 bg-white flex flex-col max-h-[80vh] overflow-y-auto">
              {sidebarContent}
            </div>
          )}
        </header>

        {/* ── Page Content ─────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Needed for the SOS button icon inside SidebarContent
function Phone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.21 12a19.79 19.79 0 0 1-3-8.57A2 2 0 0 1 3.18 1.4h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.4a16 16 0 0 0 6.29 6.29l1.36-1.36a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
