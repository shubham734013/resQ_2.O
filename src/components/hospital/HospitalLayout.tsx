import { Building2, ClipboardList, UserRound, Ambulance, BedDouble, ChevronRight, Calendar } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge';
import { useHospitalProfile } from '../../hooks/useHospitalManagement';

const links = [
  { label: 'Overview', path: '/hospital', icon: Building2 },
  { label: 'Emergency Requests', path: '/hospital/emergencies', icon: ClipboardList },
  { label: 'Care & Appointments', path: '/hospital/appointments', icon: Calendar },
  { label: 'Patients', path: '/hospital/patients', icon: UserRound },
  { label: 'Ambulances', path: '/hospital/ambulances', icon: Ambulance },
  { label: 'Resources', path: '/hospital/resources', icon: BedDouble },
  { label: 'Profile', path: '/hospital/profile', icon: Building2 },
];

export const HospitalLayout = () => {
  const location = useLocation();
  const profile = useHospitalProfile();
  const title = links.find((link) => link.path === location.pathname)?.label ?? 'Hospital';
  const hospitalName = profile.data?.name ?? 'Hospital Operations';
  const verification = profile.data?.verificationStatus ?? 'PENDING';
  const availability = profile.data?.emergencyAvailability ?? 'UNKNOWN';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-teal-950 text-teal-400 border border-teal-500/20 shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-950 text-sm tracking-tight">ResQ Health Systems™</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Hospital Command Center</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <p className="truncate text-sm font-bold text-slate-900">{hospitalName}</p>
          <div className="mt-1.5">
            <StatusBadge variant={verification === 'VERIFIED' ? 'verified' : 'waitTime'} label={verification} />
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Hospital navigation">
          {links.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/hospital'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-teal-50 text-teal-950 border border-teal-200/80 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4 text-teal-700 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 space-y-1 bg-slate-50/60">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700">Clinical Desk SLA</span>
            <span className="text-emerald-700 font-bold">99.99%</span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">Emergency Intake: {availability}</p>
          <p className="text-[10px] text-slate-400">HL7 FHIR v4 Encrypted Session</p>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm"><div className="flex h-16 items-center justify-between px-4 sm:px-6"><div><p className="text-xs text-slate-500">Hospital Operations <ChevronRight className="mx-1 inline h-3 w-3" /> {title}</p><h1 className="mt-0.5 text-lg font-semibold">{title}</h1></div><StatusBadge variant={availability === 'AVAILABLE' ? 'open' : 'waitTime'} label={availability} /></div><nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden" aria-label="Hospital navigation">{links.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/hospital'} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-3.5 w-3.5" />{label}</NavLink>)}</nav></header>
        <main className="min-h-[calc(100vh-64px)]"><Outlet /></main>
      </div>
    </div>
  );
};
