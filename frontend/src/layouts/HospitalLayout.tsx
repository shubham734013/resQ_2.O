import { useState } from 'react';
import {
  Building2,
  LayoutDashboard,
  Calendar,
  AlertTriangle,
  UserRound,
  BedDouble,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Ambulance,
  Stethoscope,
  MapPin,
  Search,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useHospitalProfile } from '../hooks/useHospitalManagement';
import { useAuth } from '../context/AuthContext';
import { hospitalApi } from '../services/hospitalApi';
import { ROUTES } from '../routes/routePaths';

const hospitalNavItems = [
  { label: 'Dashboard',              path: ROUTES.HOSPITAL.DASHBOARD,      icon: LayoutDashboard, badge: null,    isAlert: false },
  { label: 'Emergency Requests',     path: ROUTES.HOSPITAL.REQUESTS,       icon: AlertTriangle,   badge: 'live',  isAlert: true  },
  { label: 'Ambulance Coordination', path: ROUTES.HOSPITAL.EMERGENCY,      icon: Ambulance,       badge: null,    isAlert: false },
  { label: 'Patient Appointments',   path: ROUTES.HOSPITAL.APPOINTMENTS,   icon: Calendar,        badge: null,    isAlert: false },
  { label: 'Direct Care Inquiries',  path: ROUTES.HOSPITAL.CARE_REQUESTS,  icon: Building2,       badge: null,    isAlert: false },
  { label: 'Bed Management',         path: ROUTES.HOSPITAL.AVAILABILITY,   icon: BedDouble,       badge: null,    isAlert: false },
  { label: 'Services & Departments', path: ROUTES.HOSPITAL.SERVICES,       icon: Stethoscope,     badge: null,    isAlert: false },
  { label: 'Patients',               path: ROUTES.HOSPITAL.PATIENTS,       icon: UserRound,       badge: null,    isAlert: false },
  { label: 'Reports & Analytics',    path: ROUTES.HOSPITAL.ANALYTICS,      icon: BarChart3,       badge: null,    isAlert: false },
  { label: 'Notifications',          path: ROUTES.HOSPITAL.NOTIFICATIONS,  icon: Bell,            badge: 'notif', isAlert: false },
  { label: 'Profile & Settings',     path: ROUTES.HOSPITAL.SETTINGS,       icon: Settings,        badge: null,    isAlert: false },
];

export const HospitalLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const profile = useHospitalProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const emergencySummary = useQuery({
    queryKey: ['hospital', 'summary'],
    queryFn: hospitalApi.getEmergencySummary,
    refetchInterval: 30000,
  });

  const hospitalName = profile.data?.name || user?.name || 'Hospital Operations';
  const city         = profile.data?.city  || 'Jaipur';
  const state        = profile.data?.state || 'Rajasthan';
  const availability = profile.data?.emergencyAvailability || 'AVAILABLE';
  const isOnline     = availability === 'AVAILABLE' || availability === 'LIMITED';

  const activeEmergencyCount = emergencySummary.data
    ? (emergencySummary.data.RECEIVED ?? 0) + (emergencySummary.data.REVIEWING ?? 0)
      + (emergencySummary.data.PREPARING ?? 0) + (emergencySummary.data.AMBULANCE_COORDINATION ?? 0)
    : 0;
  const unreadNotifications = activeEmergencyCount;

  const handleLogout = async () => {
    try { await logout(); } finally { navigate(ROUTES.PUBLIC.LOGIN, { replace: true }); }
  };

  /* ── Sidebar Nav Item ───────────────────────────────────────── */
  const SideNavLink = ({
    label, path, icon: Icon, badge, isAlert, onClick,
  }: {
    label: string; path: string; icon: React.ElementType;
    badge: string | null; isAlert: boolean; onClick?: () => void;
  }) => {
    const count = badge === 'live' ? activeEmergencyCount : badge === 'notif' ? unreadNotifications : 0;
    return (
      <NavLink
        to={path}
        end={path === ROUTES.HOSPITAL.DASHBOARD}
        onClick={onClick}
        className={({ isActive }) =>
          `group relative flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium transition-all duration-200 ${
            isActive
              ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500 rounded-r-xl shadow-xs'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 border-l-2 border-transparent rounded-xl'
          }`
        }
      >
        <Icon className={`h-4 w-4 shrink-0 ${isAlert ? 'text-rose-400' : ''}`} />
        <span className="flex-1 truncate">{label}</span>
        {count > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold bg-rose-600 text-white shadow-xs">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 font-sans selection:bg-rose-500/20 selection:text-rose-200 antialiased">
      {/* ── Desktop Dark Glass Sidebar ──────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex bg-zinc-950/80 border-r border-white/10 backdrop-blur-xl">
        {/* Brand Header */}
        <div className="flex h-18 items-center gap-3 border-b border-white/10 px-6 shrink-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 shadow-md shadow-rose-950/50">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tight text-white leading-none">resQ</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Hospital
              </span>
            </div>
            <p className="text-[10px] font-medium text-zinc-400 mt-1 truncate max-w-[140px]">{hospitalName}</p>
          </div>
        </div>

        {/* Hospital Operational Badge */}
        <div className="px-4 py-3 shrink-0 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-200">{hospitalName}</p>
              <p className="text-[10px] font-mono text-zinc-500">Tier 1 Command Hub</p>
            </div>
            <span
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/[0.04] text-zinc-500 border border-white/10'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
              {isOnline ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Navigation - scrollable like in UserLayout */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-3 space-y-1" aria-label="Hospital Navigation">
          {hospitalNavItems.map((item) => (
            <SideNavLink key={item.label} {...item} />
          ))}
        </nav>

        {/* Emergency Protocol & Sign Out */}
        <div className="shrink-0 border-t border-white/10 p-4 space-y-3 bg-zinc-950/60">
          <div className="rounded-xl p-3 bg-rose-500/[0.06] border border-rose-500/20 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/30">
                <Phone className="h-3.5 w-3.5 text-rose-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-200">Emergency Protocol</p>
                <p className="text-[10px] text-zinc-400">Command Hotline 112</p>
              </div>
            </div>
            <a
              href="tel:112"
              className="block w-full rounded-lg py-2 text-center text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-md shadow-rose-950/40 transition"
            >
              Call Emergency Desk
            </a>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Workspace ───────────────────────────────────── */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Floating Dark Glass Header */}
        <header className="sticky top-0 z-20 bg-zinc-950/60 border-b border-white/10 backdrop-blur-md px-4 sm:px-6">
          <div className="flex h-14 items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition cursor-pointer"
              aria-label="Toggle Navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Location selector */}
            <div className="hidden sm:flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition cursor-pointer">
              <MapPin className="h-3.5 w-3.5 text-rose-500" />
              <span>{city}, {state}</span>
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </div>

            {/* Dark glass search input */}
            <div className="flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2 bg-white/[0.04] border border-white/10 focus-within:border-rose-500/40 transition">
              <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <input
                type="text"
                placeholder="Search patients, requests, appointments…"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 outline-none"
              />
            </div>

            {/* Notification bell */}
            <button
              type="button"
              className="relative p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition cursor-pointer"
              onClick={() => navigate(ROUTES.HOSPITAL.NOTIFICATIONS)}
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white bg-rose-600 shadow-xs">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            {/* Hospital Admin Pill */}
            <div className="hidden sm:flex items-center gap-2.5 rounded-xl px-3 py-1.5 bg-white/[0.04] border border-white/10 cursor-pointer hover:bg-white/[0.08] transition">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 shrink-0">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-zinc-200 leading-tight truncate max-w-[120px]">{hospitalName}</p>
                <p className="text-[10px] font-mono text-zinc-500 leading-tight">Command Admin</p>
              </div>
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </div>
          </div>

          {/* Mobile Nav Drawer */}
          {mobileOpen && (
            <div className="lg:hidden px-3 py-3 space-y-1 bg-zinc-950/95 border-t border-white/10 backdrop-blur-xl">
              {hospitalNavItems.map((item) => (
                <SideNavLink key={item.label} {...item} onClick={() => setMobileOpen(false)} />
              ))}
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
