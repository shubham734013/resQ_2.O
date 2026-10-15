import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Ambulance,
  LayoutDashboard,
  Users,
  ClipboardList,
  Radio,
  Navigation,
  BarChart3,
  Bell,
  Building2,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ambulanceProviderApi } from '../services/ambulanceProviderApi';
import { ROUTES } from '../routes/routePaths';
import { StatusBadge } from '../components/common/StatusBadge';

const providerNavItems = [
  { label: 'Fleet Command', path: ROUTES.PROVIDER.DASHBOARD, icon: LayoutDashboard },
  { label: 'Ambulances', path: ROUTES.PROVIDER.AMBULANCES, icon: Ambulance },
  { label: 'Drivers Roster', path: ROUTES.PROVIDER.DRIVERS, icon: Users },
  { label: 'Emergency Requests', path: ROUTES.PROVIDER.REQUESTS, icon: ClipboardList },
  { label: 'Live Dispatch', path: ROUTES.PROVIDER.DISPATCH, icon: Radio },
  { label: 'Trips Telemetry', path: ROUTES.PROVIDER.TRIPS, icon: Navigation },
  { label: 'Fleet Analytics', path: ROUTES.PROVIDER.ANALYTICS, icon: BarChart3 },
  { label: 'Notifications', path: ROUTES.PROVIDER.NOTIFICATIONS, icon: Bell },
  { label: 'Provider Profile', path: ROUTES.PROVIDER.PROFILE, icon: Building2 },
  { label: 'Settings', path: ROUTES.PROVIDER.SETTINGS, icon: Settings },
];

export const ProviderLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const profile = useQuery({
    queryKey: ['ambulance-provider', 'profile'],
    queryFn: ambulanceProviderApi.getProfile,
  });

  const providerName = profile.data?.name || user?.name || 'Ambulance Provider';
  const verification = profile.data?.verificationStatus || user?.verificationStatus || 'PENDING';

  const currentItem = providerNavItems.find((item) =>
    item.path === ROUTES.PROVIDER.DASHBOARD
      ? location.pathname === ROUTES.PROVIDER.DASHBOARD
      : location.pathname.startsWith(item.path)
  ) ?? providerNavItems[0];

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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-blue-950 text-blue-400 border border-blue-500/20 shadow-xs">
              <Ambulance className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-950 text-sm tracking-tight">ResQ Fleet Hub™</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Ambulance Operations</p>
            </div>
          </div>
        </div>

        {/* Provider Profile Info */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <p className="truncate text-xs font-bold text-slate-900">{providerName}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <StatusBadge variant={verification === 'VERIFIED' ? 'verified' : 'waitTime'} label={verification} />
            <span className="text-[10px] text-slate-500 font-medium">ABDM Partner</span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Provider Navigation">
          {providerNavItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === ROUTES.PROVIDER.DASHBOARD}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30 font-bold'
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
                  Ambulance Provider <ChevronRight className="h-3 w-3" /> {currentItem.label}
                </p>
                <h1 className="text-base sm:text-lg font-bold text-slate-950">{currentItem.label}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-semibold">Dispatch SLA: 99.8%</span>
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
              {providerNavItems.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  end={path === ROUTES.PROVIDER.DASHBOARD}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
