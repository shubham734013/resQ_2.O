import { useState } from 'react';
import {
  Building2,
  LayoutDashboard,
  ClipboardList,
  Calendar,
  AlertTriangle,
  UserRound,
  BedDouble,
  Activity,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { StatusBadge } from '../components/common/StatusBadge';
import { useHospitalProfile } from '../hooks/useHospitalManagement';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/routePaths';

const hospitalNavItems = [
  { label: 'Hospital Overview', path: ROUTES.HOSPITAL.DASHBOARD, icon: LayoutDashboard },
  { label: 'Emergency Requests', path: ROUTES.HOSPITAL.REQUESTS, icon: ClipboardList },
  { label: 'Appointments & Care', path: ROUTES.HOSPITAL.APPOINTMENTS, icon: Calendar },
  { label: 'Live Emergency Intake', path: ROUTES.HOSPITAL.EMERGENCY, icon: AlertTriangle, isAlert: true },
  { label: 'Patient Registry', path: ROUTES.HOSPITAL.PATIENTS, icon: UserRound },
  { label: 'Department Services', path: ROUTES.HOSPITAL.SERVICES, icon: BedDouble },
  { label: 'Bed & Intake Status', path: ROUTES.HOSPITAL.AVAILABILITY, icon: Activity },
  { label: 'Clinical Analytics', path: ROUTES.HOSPITAL.ANALYTICS, icon: BarChart3 },
  { label: 'Coordination Alerts', path: ROUTES.HOSPITAL.NOTIFICATIONS, icon: Bell },
  { label: 'Hospital Profile', path: ROUTES.HOSPITAL.PROFILE, icon: Building2 },
  { label: 'Facility Settings', path: ROUTES.HOSPITAL.SETTINGS, icon: Settings },
];

export const HospitalLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useHospitalProfile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const hospitalName = profile.data?.name || user?.name || 'Hospital Operations';
  const verification = profile.data?.verificationStatus || user?.verificationStatus || 'PENDING';
  const availability = profile.data?.emergencyAvailability || 'AVAILABLE';

  const currentItem = hospitalNavItems.find((item) =>
    item.path === ROUTES.HOSPITAL.DASHBOARD
      ? location.pathname === ROUTES.HOSPITAL.DASHBOARD || location.pathname === '/hospital'
      : location.pathname.startsWith(item.path)
  ) ?? hospitalNavItems[0];

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(ROUTES.PUBLIC.LOGIN, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        {/* Brand */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-teal-950 text-teal-400 border border-teal-500/20 shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-950 text-sm tracking-tight">ResQ Health™</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Hospital Command Center</p>
            </div>
          </div>
        </div>

        {/* Hospital Metadata */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <p className="truncate text-xs font-bold text-slate-900">{hospitalName}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <StatusBadge variant={verification === 'VERIFIED' ? 'verified' : 'waitTime'} label={verification} />
            <StatusBadge variant={availability === 'AVAILABLE' ? 'open' : 'waitTime'} label={availability} />
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Hospital Navigation">
          {hospitalNavItems.map(({ label, path, icon: Icon, isAlert }) => (
            <NavLink
              key={path}
              to={path}
              end={path === ROUTES.HOSPITAL.DASHBOARD}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isAlert
                    ? isActive
                      ? 'bg-rose-600 text-white shadow-xs font-bold'
                      : 'bg-rose-50/80 text-rose-900 border border-rose-200/80 font-bold hover:bg-rose-100'
                    : isActive
                    ? 'bg-teal-50 text-teal-950 border border-teal-200/80 shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className={`h-4 w-4 shrink-0 ${isAlert ? (location.pathname.startsWith(path) ? 'text-white' : 'text-rose-600') : 'text-teal-700'}`} />
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
                  Hospital Command <ChevronRight className="h-3 w-3" /> {currentItem.label}
                </p>
                <h1 className="text-base sm:text-lg font-bold text-slate-950">{currentItem.label}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge variant={availability === 'AVAILABLE' ? 'open' : 'waitTime'} label={`Intake: ${availability}`} />
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
              {hospitalNavItems.map(({ label, path, icon: Icon, isAlert }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  end={path === ROUTES.HOSPITAL.DASHBOARD}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                      isAlert
                        ? 'bg-rose-50 text-rose-900 border border-rose-200 font-bold'
                        : isActive
                        ? 'bg-teal-50 text-teal-950 font-bold'
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

        {/* View Content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
