import type { ReactNode } from 'react';
import { Activity, Ambulance, BarChart3, Bell, Building2, FileText, LayoutDashboard, Settings, Users, UserRoundCog } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

const navigation = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard },
  { label: 'Emergencies', path: '/admin/emergencies', icon: Activity },
  { label: 'Hospitals', path: '/admin/hospitals', icon: Building2 },
  { label: 'Ambulances', path: '/admin/ambulances', icon: Ambulance },
  { label: 'Providers', path: '/admin/providers', icon: UserRoundCog },
  { label: 'Drivers', path: '/admin/drivers', icon: UserRoundCog },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'Reports', path: '/admin/reports', icon: FileText },
  { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const current = navigation.find((item) => item.path === location.pathname) ?? navigation[0];
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-teal-950 text-teal-400 border border-teal-500/20 shadow-xs">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-950 tracking-tight">ResQ Health Systems™</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Network Governance</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 space-y-1 bg-slate-50/60">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700">Governance Engine</span>
            <span className="text-emerald-700 font-bold">Compliant</span>
          </div>
          <p className="text-[10px] text-slate-400">ISO 27001 & SOC-2 Controls Enforced</p>
          <p className="text-[10px] text-slate-400">Audit Logging: TLS 1.3 Active</p>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">ResQ Enterprise Governance / {current.label}</p>
              <h1 className="truncate text-base font-bold text-slate-950">{current.label}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Notifications" className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 sm:flex cursor-pointer">
                <Bell className="h-4 w-4" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-teal-400 border border-teal-500/20">
                RA
              </div>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden" aria-label="Mobile admin navigation">
            {navigation.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/admin'}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    isActive ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
      </div>
    </div>
  );
};
