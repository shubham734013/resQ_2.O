import { useMapRoute } from '../../hooks/useMapRoute';
import { Navigation, Clock, MapPin, Compass, RefreshCw } from 'lucide-react';
import type { Facility, UserLocation } from '../../types/facility';
import { MapView } from '../map/MapView';

export interface FacilityLocationProps { facility: Facility; userLocation: UserLocation; className?: string; }

export const FacilityLocation = ({ facility, userLocation, className = '' }: FacilityLocationProps) => {
  const { routes, isLoading, isError, refetch } = useMapRoute(facility, userLocation);
  const route = routes[0] ?? null;
  const hasCoordinates = typeof facility.latitude === 'number' && typeof facility.longitude === 'number';

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Google Maps route & navigation</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${route ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {route ? 'Google route' : 'Route unavailable'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          {route ? (
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <Navigation className="w-3.5 h-3.5" /><span>{route.distance}</span>
              <span className="text-slate-300">•</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" /><span>{route.duration}</span>
            </div>
          ) : (
            <div className="text-slate-500">{isLoading ? 'Calculating Google route…' : isError ? 'Route could not be calculated.' : 'Allow location access for a route.'}</div>
          )}
          {isError && <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-1 font-semibold text-slate-700"><RefreshCw className="w-3 h-3" />Retry</button>}
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs h-[300px] lg:h-[380px] relative">
        {hasCoordinates ? (
          <MapView
            center={{ latitude: facility.latitude, longitude: facility.longitude }}
            userLocation={Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude) ? userLocation : undefined}
            destination={{ latitude: facility.latitude, longitude: facility.longitude, name: facility.name, address: facility.address, isEmergency: facility.emergencyAvailable }}
            activeRoute={route}
            interactive
            className="h-full w-full"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">Facility location is unavailable.</div>
        )}
        <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-lg p-2.5 shadow-sm max-w-xs pointer-events-none">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 truncate"><MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" /><span className="truncate">{facility.name}</span></div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-1"><Compass className="w-3 h-3 text-slate-400" /><span>{hasCoordinates ? `${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}` : 'Coordinates unavailable'}</span></div>
        </div>
      </div>
    </div>
  );
};
