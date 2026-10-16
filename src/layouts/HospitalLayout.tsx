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
  Users,
  Ambulance,
  Stethoscope,
  MapPin,
  Search,
  Phone,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useHospitalProfile } from '../hooks/useHospitalManagement';
import { useAuth } from '../context/AuthContext';
import { hospitalApi } from '../services/hospitalApi';
import { ROUTES } from '../routes/routePaths';

const hospitalNavItems = [
  { label: 'Dashboard',              path: ROUTES.HOSPITAL.DASHBOARD,      icon: LayoutDashboard, badge: null,  isAlert: false },
  { label: 'Emergency Requests',     path: ROUTES.HOSPITAL.REQUESTS,       icon: AlertTriangle,   badge: 'live', isAlert: true  },
  { label: 'Patient Appointments',   path: ROUTES.HOSPITAL.APPOINTMENTS,   icon: Calendar,        badge: null,  isAlert: false },
  { label: 'Bed Management',         path: ROUTES.HOSPITAL.AVAILABILITY,   icon: BedDouble,       badge: null,  isAlert: false },
  { label: 'Staff Management',       path: ROUTES.HOSPITAL.SERVICES,       icon: Users,           badge: null,  isAlert: false },
  { label: 'Ambulance Coordination', path: ROUTES.HOSPITAL.EMERGENCY,      icon: Ambulance,       badge: null,  isAlert: false },
  { label: 'Services & Departments', path: ROUTES.HOSPITAL.SERVICES,       icon: Stethoscope,     badge: null,  isAlert: false },
  { label: 'Patients',               path: ROUTES.HOSPITAL.PATIENTS,       icon: UserRound,       badge: null,  isAlert: false },
  { label: 'Reports & Analytics',    path: ROUTES.HOSPITAL.ANALYTICS,      icon: BarChart3,       badge: null,  isAlert: false },
  { label: 'Notifications',          path: ROUTES.HOSPITAL.NOTIFICATIONS,  icon: Bell,            badge: 'notif', isAlert: false },
  { label: 'Profile & Settings',     path: ROUTES.HOSPITAL.SETTINGS,       icon: Settings,        badge: null,  isAlert: false },
];

export const HospitalLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const profile = useHospitalProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Fetch live emergency count for the sidebar badge
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
    ? (emergencySummary.data.RECEIVED ?? 0) + (emergencySummary.data.REVIEWING ?? 0) + (emergencySummary.data.PREPARING ?? 0) + (emergencySummary.data.AMBULANCE_COORDINATION ?? 0)
    : 0;

  const unreadNotifications = activeEmergencyCount; // proxy for header bell


  const handleLogout = async () => {
    try { await logout(); } finally { navigate(ROUTES.PUBLIC.LOGIN, { replace: true }); }
  };

  /* ── Sidebar Nav Item ───────────────────────────────────────────── */
  const SideNavLink = ({ label, path, icon: Icon, badge, isAlert, onClick }: {
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
          `flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
            isAlert
              ? isActive
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
              : isActive
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{label}</span>
        {count > 0 && (
          <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
            isAlert ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
          }`}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">

      {/* ── Desktop Sidebar ────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">

        {/* Brand */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-950 text-sm tracking-tight">Hospital Panel</p>
              <p className="text-[10px] font-medium text-slate-500 truncate max-w-[130px]">{hospitalName}, {city}</p>
            </div>
          </div>
        </div>

        {/* Hospital Card */}
        <div className="px-4 py-3 border-b border-slate-100 bg-blue-50/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900">{hospitalName}</p>
              <p className="text-[10px] text-slate-500">Hospital Admin</p>
            </div>
            <span className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3" aria-label="Hospital Navigation">
          {hospitalNavItems.map((item) => (
            <SideNavLink key={item.label} {...item} />
          ))}
        </nav>

        {/* Need Help */}
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="rounded-xl bg-blue-50 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                <Phone className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900">Need Help?</p>
                <p className="text-[10px] text-blue-600">Contact ResQ Support</p>
              </div>
            </div>
            <a
              href="tel:112"
              className="block w-full rounded-lg bg-blue-600 py-1.5 text-center text-[11px] font-bold text-white hover:bg-blue-700 transition"
            >
              Contact Support
            </a>
          </div>
        </div>

        {/* Logout */}
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

      {/* ── Main Content ───────────────────────────────────────────── */}
      <div className="lg:pl-64 flex flex-col min-h-screen">

        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100"
              aria-label="Toggle Navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Location pill */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              <span>{city}, {state}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Search */}
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="Search patients, requests, appointments…"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none"
              />
            </div>

            {/* Notification bell */}
            <button
              className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              onClick={() => navigate(ROUTES.HOSPITAL.NOTIFICATIONS)}
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            {/* Hospital name + role */}
            <div className="hidden sm:flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer hover:bg-slate-100 transition">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">{hospitalName}</p>
                <p className="text-[10px] text-slate-500 leading-tight">Hospital Admin</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* Mobile Nav Drawer */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-slate-200 bg-white px-3 py-3 space-y-0.5">
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
