import { useState } from 'react';
import {
  Activity,
  Ambulance,
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  UserRoundCog,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Calendar,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/routePaths';

const adminNavItems = [
  { label: 'Governance Overview', path: ROUTES.ADMIN.DASHBOARD, icon: LayoutDashboard },
  { label: 'Citizen Users', path: ROUTES.ADMIN.USERS, icon: Users },
  { label: 'Hospitals Directory', path: ROUTES.ADMIN.HOSPITALS, icon: Building2 },
  { label: 'Ambulance Providers', path: ROUTES.ADMIN.PROVIDERS, icon: UserRoundCog },
  { label: 'Paramedic Drivers', path: ROUTES.ADMIN.DRIVERS, icon: UserRoundCog },
  { label: 'Ambulance Fleets', path: ROUTES.ADMIN.AMBULANCES, icon: Ambulance },
  { label: 'Emergency Requests', path: ROUTES.ADMIN.REQUESTS, icon: Activity },
  { label: 'Appointments Registry', path: ROUTES.ADMIN.APPOINTMENTS, icon: Calendar },
  { label: 'Network Analytics', path: ROUTES.ADMIN.ANALYTICS, icon: BarChart3 },
  { label: 'Audit Logs & Reports', path: ROUTES.ADMIN.AUDIT_LOGS, icon: FileText },
  { label: 'System Settings', path: ROUTES.ADMIN.SETTINGS, icon: Settings },
];

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentItem = adminNavItems.find((item) =>
    item.path === ROUTES.ADMIN.DASHBOARD
      ? location.pathname === ROUTES.ADMIN.DASHBOARD || location.pathname === '/admin'
      : location.pathname.startsWith(item.path)
  ) ?? adminNavItems[0];

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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-teal-950 text-teal-400 border border-teal-500/20 shadow-xs">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-950 tracking-tight">ResQ Governance™</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">State Administration</p>
          </div>
        </div>

        {/* Admin identity badge */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <p className="truncate text-xs font-bold text-slate-900">{user?.name || user?.email || 'Administrator'}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-teal-300">
              STATE ROOT
            </span>
            <span className="text-[10px] text-slate-400">TLS 1.3 MFA</span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Admin Navigation">
          {adminNavItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === ROUTES.ADMIN.DASHBOARD}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
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
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100"
                aria-label="Toggle Navigation"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  ResQ Enterprise Governance <ChevronRight className="h-3 w-3" /> {currentItem.label}
                </p>
                <h1 className="truncate text-base font-bold text-slate-950">{currentItem.label}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                SOC-2 Type II Certified
              </span>
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
              {adminNavItems.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  end={path === ROUTES.ADMIN.DASHBOARD}
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
        <main className="flex-1 min-h-[calc(100vh-64px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
