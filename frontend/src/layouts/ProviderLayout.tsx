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
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ambulanceProviderApi } from '../services/ambulanceProviderApi';
import { ROUTES } from '../routes/routePaths';

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
  const [collapsed, setCollapsed] = useState(false);

  const profile = useQuery({
    queryKey: ['ambulance-provider', 'profile'],
    queryFn: ambulanceProviderApi.getProfile,
  });

  const providerName = profile.data?.name || user?.name || 'Ambulance Provider';

  const currentItem =
    providerNavItems.find((item) =>
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

  const sidebarWidth = collapsed ? 'w-[76px]' : 'w-68';

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 font-sans antialiased relative selection:bg-rose-500/30 selection:text-white overflow-x-hidden">
      {/* Subtle SVG Noise Overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Atmospheric Radial Ambient Glows behind active telemetry */}
      <div
        className="pointer-events-none fixed top-0 right-1/4 h-96 w-96 rounded-full blur-[140px] opacity-15"
        style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-1/4 left-1/3 h-96 w-96 rounded-full blur-[140px] opacity-10"
        style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
      />

      {/* Desktop Sidebar: Collapsible Dark Glass */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden ${sidebarWidth} flex-col transition-all duration-300 lg:flex bg-zinc-950/80 border-r border-white/10 backdrop-blur-xl`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 shadow-md shadow-rose-950/50">
              <Ambulance className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black tracking-tight text-white leading-none">resQ</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    FLEET
                  </span>
                </div>
                <p className="text-[10px] font-medium text-zinc-400 mt-1">Fleet Command & Telemetry</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Provider Profile Card: Dark Glass Container */}
        {!collapsed && (
          <div className="mx-3.5 my-3 rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 backdrop-blur-md shadow-xl shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Operational Grid</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Fleet #RJ14</span>
            </div>

            <p className="truncate text-xs font-bold text-white leading-snug">{providerName}</p>

            <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3 text-rose-400" />
                <span>VERIFIED ABDM Partner</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">24/7 Grid</span>
            </div>
          </div>
        )}

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Provider Navigation">
          {providerNavItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === ROUTES.PROVIDER.DASHBOARD}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500 rounded-r-xl'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] rounded-xl'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer info & Logout */}
        <div className="border-t border-white/10 p-3 bg-zinc-950/60 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-white/[0.04] transition cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-68'} flex flex-col min-h-screen`}>
        {/* Top Header: Floating Dark Glass */}
        <header className="sticky top-0 z-20 bg-zinc-950/60 border-b border-white/10 backdrop-blur-md px-6 py-4">
          <div className="flex h-10 items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-xl text-zinc-300 hover:bg-white/[0.06] transition cursor-pointer"
                aria-label="Toggle Navigation"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <div>
                <p className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                  <span>Fleet Command Hub</span>
                  <ChevronRight className="h-3 w-3 text-zinc-600" />
                  <span className="text-zinc-300">{currentItem.label}</span>
                </p>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none mt-1">
                  {currentItem.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Header Metrics: SLA Status dark glass pill with soft green pulse dot */}
              <div className="hidden sm:flex items-center gap-2 bg-white/[0.04] border border-white/10 text-emerald-400 text-xs font-mono px-3 py-1.5 rounded-xl shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold">Dispatch SLA: 99.8%</span>
              </div>

              {/* Real-time Telemetry Engine indicator */}
              <div className="hidden md:flex items-center gap-1.5 bg-white/[0.04] border border-white/10 text-zinc-300 text-xs font-mono px-3 py-1.5 rounded-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                <span>Grid: Active</span>
              </div>

              {/* Notifications */}
              <NavLink
                to={ROUTES.PROVIDER.NOTIFICATIONS}
                className="relative p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/[0.06] transition"
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
              </NavLink>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-white/[0.06] transition cursor-pointer"
                title="Sign out"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl px-3 py-3 space-y-1 mt-4 rounded-2xl shadow-2xl">
              {providerNavItems.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  end={path === ROUTES.PROVIDER.DASHBOARD}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500'
                        : 'text-zinc-300 hover:bg-white/[0.05]'
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
