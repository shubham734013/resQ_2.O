import { Navigation, Clock, MapPin, Compass } from 'lucide-react';
import type { Facility, UserLocation } from '../../types/facility';
import { MapPlaceholder } from '../map/MapPlaceholder';

export interface FacilityLocationProps {
  facility: Facility;
  userLocation: UserLocation;
  className?: string;
}

export const FacilityLocation = ({
  facility,
  userLocation,
  className = '',
}: FacilityLocationProps) => {
  const route = facility.routeSummary ?? {
    distance: facility.distance,
    duration: facility.estimatedTime,
    viaRoute: 'Direct arterial route',
    trafficCondition: 'Moderate traffic',
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Route Summary Box */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Route & Navigation Summary
          </span>
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded ${
              route.trafficCondition === 'Light traffic'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {route.trafficCondition}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <Navigation className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
            <span>{route.distance}</span>
            <span className="text-slate-300">•</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>{route.duration}</span>
          </div>

          <span className="text-slate-500 text-[11px] truncate max-w-[200px]">
            {route.viaRoute}
          </span>
        </div>
      </div>

      {/* Map Canvas Frame */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs h-[300px] lg:h-[380px] relative">
        <MapPlaceholder
          facilities={[facility]}
          selectedFacility={facility}
          userLocation={userLocation}
          onSelectFacility={() => {}}
        />

        {/* Destination Callout Overlay */}
        <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-lg p-2.5 shadow-sm max-w-xs text-xs pointer-events-none">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 truncate">
            <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" aria-hidden="true" />
            <span className="truncate">{facility.name}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-1">
            <Compass className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <span>
              {facility.latitude.toFixed(4)}, {facility.longitude.toFixed(4)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
