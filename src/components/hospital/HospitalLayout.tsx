import { Building2, ClipboardList, UserRound, Ambulance, BedDouble, ChevronRight } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MOCK_HOSPITAL } from '../../data/hospitalMock';
import { StatusBadge } from '../common/StatusBadge';

const links = [
  { label: 'Overview', path: '/hospital', icon: Building2 },
  { label: 'Emergency Requests', path: '/hospital/emergencies', icon: ClipboardList },
  { label: 'Patients', path: '/hospital/patients', icon: UserRound },
  { label: 'Ambulances', path: '/hospital/ambulances', icon: Ambulance },
  { label: 'Resources', path: '/hospital/resources', icon: BedDouble },
  { label: 'Profile', path: '/hospital/profile', icon: Building2 },
];

export const HospitalLayout = () => {
  const location = useLocation();
  const title = links.find((link) => link.path === location.pathname)?.label ?? 'Hospital';
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 px-5 py-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white"><Building2 className="h-5 w-5" /></div><div><p className="font-semibold">ResQ</p><p className="text-xs text-slate-500">Hospital Operations</p></div></div></div>
        <div className="px-5 py-4"><p className="truncate text-sm font-semibold">{MOCK_HOSPITAL.name}</p><div className="mt-2"><StatusBadge variant="verified" label="Verified" /></div></div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Hospital navigation">{links.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/hospital'} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4" /><span>{label}</span></NavLink>)}</nav>
        <div className="border-t border-slate-200 p-4"><p className="text-xs text-slate-500">Prototype data</p><p className="mt-1 text-xs text-slate-400">Operational values are mocked.</p></div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm"><div className="flex h-16 items-center justify-between px-4 sm:px-6"><div><p className="text-xs text-slate-500">Hospital Operations <ChevronRight className="mx-1 inline h-3 w-3" /> {title}</p><h1 className="mt-0.5 text-lg font-semibold">{title}</h1></div><StatusBadge variant="open" label="Emergency available" /></div><nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden" aria-label="Hospital navigation">{links.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/hospital'} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-3.5 w-3.5" />{label}</NavLink>)}</nav></header>
        <main className="min-h-[calc(100vh-64px)]"><Outlet /></main>
      </div>
    </div>
  );
};
