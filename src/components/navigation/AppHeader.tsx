import { NavLink, useNavigate } from 'react-router-dom';
import { ShieldAlert, Compass } from 'lucide-react';
import { LocationIndicator } from '../search/LocationIndicator';
import { Button } from '../common/Button';
import type { UserLocation } from '../../types/facility';

export interface AppHeaderProps {
  userLocation: UserLocation;
  isUpdatingLocation?: boolean;
  onRefreshLocation?: () => void;
  className?: string;
}

export const AppHeader = ({
  userLocation,
  isUpdatingLocation = false,
  onRefreshLocation,
  className = '',
}: AppHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header
      role="banner"
      className={`bg-white border-b border-slate-200/90 sticky top-0 z-30 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4">
        {/* Left: Branding & Tagline */}
        <div className="flex items-center gap-6 shrink-0">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-md p-0.5"
            aria-label="ResQ Home"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs group-hover:bg-slate-800 transition-colors">
              <Compass className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-950 text-base tracking-tight leading-none">
                ResQ
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-tight hidden sm:inline leading-tight mt-0.5">
                Healthcare Navigation
              </span>
            </div>
          </NavLink>

          {/* Location indicator on desktop / tablet */}
          <div className="hidden sm:block">
            <LocationIndicator
              location={userLocation}
              isUpdating={isUpdatingLocation}
              onRefresh={onRefreshLocation}
            />
          </div>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav
          aria-label="Desktop primary navigation"
          className="hidden md:flex items-center gap-1 text-sm font-medium"
        >
          <NavLink
            to="/"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md transition-colors ${
                isActive
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md transition-colors ${
                isActive
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            Search
          </NavLink>
          <NavLink
            to="/saved"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md transition-colors ${
                isActive
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            Saved
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md transition-colors ${
                isActive
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            Profile
          </NavLink>
        </nav>

        {/* Right: Emergency SOS Action (Persistent but non-dominant) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="emergency"
            size="sm"
            icon={<ShieldAlert className="w-4 h-4 text-white" aria-hidden="true" />}
            onClick={() => navigate('/sos')}
            aria-label="Access Emergency SOS coordination"
            className="tracking-tight px-3 py-1.5 text-xs sm:text-sm font-semibold"
          >
            <span className="hidden sm:inline">Emergency SOS</span>
            <span className="sm:hidden">SOS</span>
          </Button>
        </div>
      </div>

      {/* Mobile Location Sub-bar */}
      <div className="sm:hidden px-4 py-1.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between">
        <LocationIndicator
          location={userLocation}
          isUpdating={isUpdatingLocation}
          onRefresh={onRefreshLocation}
          compact
          className="border-none bg-transparent shadow-none p-0 text-[11px]"
        />
      </div>
    </header>
  );
};
