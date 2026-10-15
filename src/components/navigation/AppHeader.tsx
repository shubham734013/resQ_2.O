import { NavLink, useNavigate } from 'react-router-dom';
import { ShieldAlert, Compass, LogOut } from 'lucide-react';
import { LocationIndicator } from '../search/LocationIndicator';
import { Button } from '../common/Button';
import type { UserLocation } from '../../types/facility';
import { useAuth } from '../../context/AuthContext';

export interface AppHeaderProps {
  userLocation: UserLocation;
  isUpdatingLocation?: boolean;
  onRefreshLocation?: () => void;
  className?: string;
}

export const AppHeader = ({ userLocation, isUpdatingLocation = false, onRefreshLocation, className = '' }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try { await logout(); }
    finally { navigate('/login', { replace: true }); }
  };

  const navigation = [
    { path: '/', label: 'Home' },
    { path: '/search', label: 'Search' },
    ...(user ? [{ path: '/appointments', label: 'Appointments' }] : []),
    { path: '/saved', label: 'Saved' },
    { path: '/profile', label: 'Profile' },
  ];

  return (
    <header role="banner" className={`bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] ${className}`}>
      {/* Top Enterprise Utility Bar */}
      <div className="hidden lg:block bg-slate-900 text-slate-300 text-[11px] px-4 sm:px-6 lg:px-8 py-1.5 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ResQ Network Active</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">99.99% Target SLA Uptime</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">HL7 FHIR v4 Ready</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Enterprise Portals:
            </span>
            <NavLink to="/hospital" className="hover:text-teal-400 text-slate-300 font-medium transition-colors">
              Hospital Ops
            </NavLink>
            <span className="text-slate-700">|</span>
            <NavLink to="/ambulance-provider" className="hover:text-teal-400 text-slate-300 font-medium transition-colors">
              Fleet CAD
            </NavLink>
            <span className="text-slate-700">|</span>
            <NavLink to="/ambulance" className="hover:text-teal-400 text-slate-300 font-medium transition-colors">
              Driver Console
            </NavLink>
            <span className="text-slate-700">|</span>
            <NavLink to="/admin" className="hover:text-teal-400 text-slate-300 font-medium transition-colors">
              Governance
            </NavLink>
            <span className="text-slate-700">|</span>
            <a href="tel:112" className="text-rose-400 hover:text-rose-300 font-bold">
              Dispatch: 112
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 shrink-0">
          <NavLink to="/" className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded-lg p-1" aria-label="ResQ Home">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-teal-950 text-white flex items-center justify-center font-bold text-base shadow-sm group-hover:from-slate-800 group-hover:to-teal-900 transition-all border border-teal-500/20">
              <Compass className="w-5 h-5 text-teal-400 group-hover:rotate-45 transition-transform duration-300" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-slate-950 text-lg tracking-tight leading-none flex items-center gap-1">
                ResQ
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500"></span>
              </span>
              <span className="text-[10px] text-teal-700 font-bold tracking-wide uppercase hidden sm:inline leading-tight mt-0.5">
                Health Technologies™
              </span>
            </div>
          </NavLink>
          <div className="hidden sm:block">
            <LocationIndicator location={userLocation} isUpdating={isUpdatingLocation} onRefresh={onRefreshLocation} />
          </div>
        </div>
        <nav aria-label="Desktop primary navigation" className="hidden md:flex items-center gap-1 text-sm font-medium">
          {navigation.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 border border-teal-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/70'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 shrink-0">
          {user ? (
            <>
              <span className="hidden lg:block max-w-36 truncate text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md" title={user.email}>
                {user.name || user.email}
              </span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                aria-label="Log out"
              >
                <LogOut className="h-3.5 w-3.5" />Logout
              </button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => navigate('/login')} className="hidden sm:inline-flex font-semibold">
              Sign In
            </Button>
          )}
          <button
            type="button"
            onClick={() => navigate('/sos')}
            aria-label="Access Emergency SOS coordination"
            className="resq-emergency-pulse inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold text-xs sm:text-sm tracking-tight shadow-md hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 cursor-pointer active:scale-95"
          >
            <ShieldAlert className="w-4 h-4 text-white animate-pulse" aria-hidden="true" />
            <span className="hidden sm:inline">Emergency SOS</span>
            <span className="sm:hidden">SOS</span>
          </button>
        </div>
      </div>
      <div className="sm:hidden px-4 py-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between">
        <LocationIndicator location={userLocation} isUpdating={isUpdatingLocation} onRefresh={onRefreshLocation} compact className="border-none bg-transparent shadow-none p-0 text-[11px]" />
        {user ? (
          <button type="button" onClick={() => void handleLogout()} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700" aria-label="Log out">
            <LogOut className="h-3.5 w-3.5" />Logout
          </button>
        ) : (
          <button type="button" onClick={() => navigate('/login')} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800">
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
