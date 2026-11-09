import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  AlertTriangle,
  Ambulance,
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
  Shield,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocationState } from '../hooks/useLocationState';
import { ROUTES } from '../routes/routePaths';

interface UserNavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  isEmergency?: boolean;
  badge?: number;
}

// ─── Nav items matching the reference architecture ─────────────────────────
const userNavItems: UserNavItem[] = [
  { label: 'Home', path: ROUTES.USER.DASHBOARD, icon: LayoutDashboard },
  { label: 'SOS Emergency', path: ROUTES.USER.EMERGENCY, icon: AlertTriangle, isEmergency: true },
  { label: 'Find Ambulance', path: ROUTES.USER.AMBULANCES, icon: Ambulance },
  { label: 'Nearby Hospitals', path: ROUTES.USER.HOSPITALS, icon: Building2 },
  { label: 'Doctor Appointments', path: ROUTES.USER.APPOINTMENTS, icon: Calendar },
  { label: 'Care Inquiries', path: ROUTES.USER.REQUESTS, icon: Heart },
  { label: 'Saved Locations', path: ROUTES.USER.SAVED, icon: Bookmark },
  { label: 'Notifications', path: ROUTES.USER.NOTIFICATIONS, icon: Bell },
  { label: 'Profile', path: ROUTES.USER.PROFILE, icon: User },
];

export const UserLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const locationState = useLocationState();
  const { currentLocation, isUpdating, refreshLocation } = locationState;
  const isEmergencyPage = routerLocation.pathname.startsWith(ROUTES.USER.EMERGENCY);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const context = {
    currentLocation: locationState.currentLocation,
    location: locationState.location,
    permissionState: locationState.permissionState,
    locationError: locationState.locationError,
    refreshLocation: locationState.refreshLocation,
    isUpdating: locationState.isUpdating,
  };

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
      {/* Brand Header */}
      <div className="flex h-18 items-center gap-3 border-b border-white/10 px-6 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 shadow-md shadow-rose-950/50">
          <HeartPulse className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black tracking-tight text-white leading-none">ResQ</span>
            {/* <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
              2.O
            </span> */}
          </div>
          <p className="text-[10px] font-medium text-zinc-400 mt-1">Faster Help. Safer Tomorrow.</p>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1" aria-label="Citizen Navigation">
        {userNavItems.map(({ label, path, icon: Icon, isEmergency, badge }) => (
          <NavLink
            key={`${path}-${label}`}
            to={path}
            end={path === ROUTES.USER.DASHBOARD}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500 rounded-r-xl shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] rounded-xl'
              }`
            }
          >
            <Icon className={`h-4.5 w-4.5 shrink-0 ${isEmergency ? 'text-rose-400' : ''}`} />
            <span className="flex-1 truncate">{label}</span>
            {badge != null && badge > 0 && (
              <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Quick SOS Trigger & Emergency Card */}
      <div className="border-t border-white/10 p-4 space-y-3 bg-zinc-950/60 shrink-0">
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <p className="text-xs font-bold text-zinc-200">Emergency Protocol</p>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Tap SOS for immediate paramedic dispatch</p>
        </div>

        <Link
          to={ROUTES.USER.EMERGENCY}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-semibold py-3.5 text-sm shadow-lg shadow-rose-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all group cursor-pointer"
          onClick={() => setMobileOpen(false)}
        >
          <PhoneIcon className="h-4 w-4 animate-pulse" />
          <span>TRIGGER SOS</span>
        </Link>
        <p className="text-center text-[10px] text-zinc-500 font-medium">Instant 24×7 Emergency Dispatch</p>

        {/* Sign Out */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-white/[0.03] transition cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#08090a] text-zinc-100 font-sans antialiased selection:bg-rose-500/30 selection:text-white">
      {/* ── Desktop Collapsible Dark Glass Sidebar ─────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-zinc-950/80 backdrop-blur-xl lg:flex lg:flex-col">
        {sidebarContent}
      </aside>

      {/* ── Main Portal Workspace ────────────────────────────────────────── */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* ── Top Floating Header (Hidden during Emergency Mode wizard) ── */}
        {!isEmergencyPage && (
          <header className="sticky top-0 z-30 bg-zinc-950/60 border-b border-white/10 backdrop-blur-md px-6 py-4">
            <div className="flex h-10 items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl text-zinc-300 hover:bg-white/[0.06] transition cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Mobile brand badge */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 shadow-sm">
                <HeartPulse className="h-4 w-4 text-white" />
              </div>
              <span className="font-black text-white text-sm">resQ 2.O</span>
            </div>

            {/* Location Selector: Dark Glass Pill */}
            <button
              type="button"
              onClick={refreshLocation}
              disabled={isUpdating}
              className="hidden sm:flex items-center gap-2 bg-white/[0.04] border border-white/10 text-zinc-200 text-sm rounded-xl px-4 py-2 hover:bg-white/[0.08] transition-all min-w-0 cursor-pointer"
              title="Click to refresh live GPS location"
            >
              <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="truncate max-w-[140px] font-medium">{cityLabel}, {stateLabel}</span>
              {isUpdating ? (
                <RefreshCw className="h-3 w-3 animate-spin text-rose-400 shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 text-zinc-400 shrink-0" />
              )}
            </button>

            {/* Integrated Search Input: Dark Glass Pill */}
            <div className="flex-1 hidden md:flex items-center gap-2.5 bg-white/[0.04] border border-white/10 text-zinc-100 placeholder:text-zinc-500 rounded-xl px-4 py-2 w-80 max-w-sm focus-within:border-white/20 transition-all">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Search hospitals, ambulances, services..."
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none min-w-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(ROUTES.USER.HOSPITALS);
                }}
                onClick={() => navigate(ROUTES.USER.HOSPITALS)}
              />
            </div>

            {/* Right Controls: Notifications & Profile Dropdown */}
            <div className="flex items-center gap-2.5 ml-auto">
              {/* Notification bell */}
              <NavLink
                to={ROUTES.USER.NOTIFICATIONS}
                className="relative p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/[0.06] transition"
                aria-label="View notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
              </NavLink>

              {/* Profile Menu: Dark dropdown container */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 hover:bg-white/[0.08] transition text-zinc-200 cursor-pointer"
                  aria-expanded={profileDropdownOpen}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-600 to-rose-700 text-white text-xs font-black shadow-xs shrink-0">
                    {(user?.name ?? user?.email ?? 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-bold text-zinc-100 leading-none">{user?.name || user?.email || 'Citizen'}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Citizen</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                </button>

                {/* Dark Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-zinc-950/95 border border-white/10 shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2.5 border-b border-white/10">
                      <p className="text-xs font-bold text-white truncate">{user?.name || 'Citizen User'}</p>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{user?.email || 'user@resq.internal'}</p>
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-300">
                        <Shield className="h-3 w-3" />
                        <span>Verified Citizen Account</span>
                      </div>
                    </div>

                    <div className="py-1 space-y-0.5">
                      <Link
                        to={ROUTES.USER.PROFILE}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition"
                      >
                        <User className="h-3.5 w-3.5 text-zinc-400" />
                        <span>My Profile</span>
                      </Link>
                      <Link
                        to={ROUTES.USER.SAVED}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition"
                      >
                        <Bookmark className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Saved Locations</span>
                      </Link>
                      <Link
                        to={ROUTES.USER.SETTINGS}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition"
                      >
                        <Settings className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Preferences</span>
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          void handleLogout();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Navigation Drawer: Dark Glass */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl flex flex-col max-h-[85vh] overflow-y-auto mt-4 rounded-2xl p-2 shadow-2xl">
              {sidebarContent}
            </div>
          )}
        </header>
        )}

        {/* ── Page Content ─────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
};

// Phone icon helper for SOS trigger
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.21 12a19.79 19.79 0 0 1-3-8.57A2 2 0 0 1 3.18 1.4h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.4a16 16 0 0 0 6.29 6.29l1.36-1.36a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
