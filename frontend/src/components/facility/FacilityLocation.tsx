import { useMapRoute } from '../../hooks/useMapRoute';
import { Navigation, Clock, MapPin, Compass, RefreshCw } from 'lucide-react';
import type { Facility, UserLocation } from '../../types/facility';
import { MapView, darkMapStyle } from '../map/MapView';

export interface FacilityLocationProps {
  facility: Facility;
  userLocation: UserLocation;
  className?: string;
}

export const FacilityLocation = ({ facility, userLocation, className = '' }: FacilityLocationProps) => {
  const { routes, isLoading, isError, refetch } = useMapRoute(facility, userLocation);
  const route = routes[0] ?? null;
  const latitude = facility.latitude;
  const longitude = facility.longitude;
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';

  return (
    <div className={`space-y-4 font-sans ${className}`}>
      {/* Route & Navigation Card */}
      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
              Live Route Telemetry
            </span>
          </div>
          <span
            className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${
              route
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                : 'bg-white/[0.04] text-zinc-400 border border-white/10'
            }`}
          >
            {route ? 'Google High-Speed Route' : 'Route Calculating'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs gap-3">
          {route ? (
            <div className="flex items-center gap-3 text-zinc-100 font-mono">
              <span className="flex items-center gap-1.5 font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                <Navigation className="w-3.5 h-3.5 text-rose-400" />
                {route.distance}
              </span>
              <span className="text-zinc-500">•</span>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                {route.duration}
              </span>
            </div>
          ) : (
            <div className="text-zinc-400 text-xs">
              {isLoading
                ? 'Calculating Google Route…'
                : isError
                ? 'Route could not be calculated.'
                : 'Allow location access for live route.'}
            </div>
          )}

          {isError && (
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      {/* Embedded Native Google Maps Viewport with Dark Glass Frame & darkMapStyle */}
      <div className="border border-white/10 rounded-2xl overflow-hidden shadow-2xl h-[320px] lg:h-[400px] relative bg-[#070709]">
        {hasCoordinates && typeof latitude === 'number' && typeof longitude === 'number' ? (
          <MapView
            center={{ latitude, longitude }}
            userLocation={Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude) ? userLocation : undefined}
            destination={{ latitude, longitude, name: facility.name, address: facility.address, isEmergency: facility.emergencyAvailable }}
            activeRoute={route}
            interactive
            options={{ styles: darkMapStyle }}
            className="h-full w-full"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-zinc-500">
            Facility location is unavailable.
          </div>
        )}

        {/* Floating Dark Glass HUD Overlay */}
        <div className="absolute top-3 left-3 z-20 bg-zinc-950/85 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl max-w-xs pointer-events-none">
          <div className="flex items-center gap-1.5 font-medium text-xs text-zinc-100 truncate">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{facility.name}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-1">
            <Compass className="w-3 h-3 text-zinc-500" />
            <span>{hasCoordinates ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : 'Coordinates unavailable'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
