import type { ReactNode } from 'react';
import { Activity, Ambulance, BarChart3, Bell, Building2, FileText, LayoutDashboard, Settings, Users } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { ADMIN_LAST_UPDATED } from '../../data/adminMock';

const navigation = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard },
  { label: 'Emergencies', path: '/admin/emergencies', icon: Activity },
  { label: 'Hospitals', path: '/admin/hospitals', icon: Building2 },
  { label: 'Ambulances', path: '/admin/ambulances', icon: Ambulance },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'Reports', path: '/admin/reports', icon: FileText },
  { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const current = navigation.find((item) => item.path === location.pathname) ?? navigation[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white"><Activity className="h-4 w-4" /></div><div><p className="text-sm font-bold">ResQ</p><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Operations</p></div></div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Admin navigation">
          {navigation.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/admin'} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><Icon className="h-4 w-4" />{label}</NavLink>)}
        </nav>
        <div className="border-t border-slate-200 p-4"><p className="text-xs font-semibold text-slate-700">Admin workspace</p><p className="mt-1 text-[11px] text-slate-400">{ADMIN_LAST_UPDATED}</p></div>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 xl:px-8"><div className="min-w-0"><p className="text-xs text-slate-400">ResQ Operations / {current.label}</p><h1 className="truncate text-base font-semibold text-slate-950">{current.label}</h1></div><div className="flex items-center gap-2"><button type="button" aria-label="Notifications" className="hidden h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 sm:flex"><Bell className="h-4 w-4" /></button><div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">RA</div></div></div>
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden" aria-label="Mobile admin navigation">{navigation.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/admin'} className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'}`}><Icon className="h-3.5 w-3.5" />{label}</NavLink>)}</nav>
        </header>
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
      </div>
    </div>
  );
};
