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
    { path: '/', label: 'Home' }, { path: '/search', label: 'Search' }, { path: '/saved', label: 'Saved' }, { path: '/profile', label: 'Profile' },
  ];

  return (
    <header role="banner" className={`bg-white border-b border-slate-200/90 sticky top-0 z-30 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 shrink-0">
          <NavLink to="/" className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-md p-0.5" aria-label="ResQ Home">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs group-hover:bg-slate-800 transition-colors"><Compass className="w-4 h-4 text-white" aria-hidden="true" /></div>
            <div className="flex flex-col"><span className="font-bold text-slate-950 text-base tracking-tight leading-none">ResQ</span><span className="text-[10px] text-slate-500 font-medium tracking-tight hidden sm:inline leading-tight mt-0.5">Healthcare Navigation</span></div>
          </NavLink>
          <div className="hidden sm:block"><LocationIndicator location={userLocation} isUpdating={isUpdatingLocation} onRefresh={onRefreshLocation} /></div>
        </div>
        <nav aria-label="Desktop primary navigation" className="hidden md:flex items-center gap-1 text-sm font-medium">
          {navigation.map(({ path, label }) => <NavLink key={path} to={path} className={({ isActive }) => `px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-slate-100 text-slate-950 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>{label}</NavLink>)}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <span className="hidden lg:block max-w-36 truncate text-xs text-slate-500" title={user.email}>{user.email}</span>
              <button type="button" onClick={() => void handleLogout()} className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" aria-label="Log out"><LogOut className="h-3.5 w-3.5" />Logout</button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => navigate('/login')} className="hidden sm:inline-flex">Sign In</Button>
          )}
          <Button variant="emergency" size="sm" icon={<ShieldAlert className="w-4 h-4 text-white" aria-hidden="true" />} onClick={() => navigate('/sos')} aria-label="Access Emergency SOS coordination" className="tracking-tight px-3 py-1.5 text-xs sm:text-sm font-semibold"><span className="hidden sm:inline">Emergency SOS</span><span className="sm:hidden">SOS</span></Button>
        </div>
      </div>
      <div className="sm:hidden px-4 py-1.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between"><LocationIndicator location={userLocation} isUpdating={isUpdatingLocation} onRefresh={onRefreshLocation} compact className="border-none bg-transparent shadow-none p-0 text-[11px]" />{user ? <button type="button" onClick={() => void handleLogout()} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700" aria-label="Log out"><LogOut className="h-3.5 w-3.5" />Logout</button> : <button type="button" onClick={() => navigate('/login')} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">Sign In</button>}</div>
    </header>
  );
};
