import {
  Navigation,
  Clock,
  Phone,
  ShieldAlert,
  Flame,
  ShieldCheck,
  MapPin,
  CircleDot,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { Facility } from '../../types/facility';
import type { RouteOptionItem } from '../../types/route';
import { Button } from '../common/Button';

export interface RouteSummaryProps {
  facility: Facility;
  selectedRoute: RouteOptionItem;
  isEmergency?: boolean;
  currentLocationName?: string;
  onStartNavigation: () => void;
  onCallFacility: () => void;
  className?: string;
}

export const RouteSummary = ({
  facility,
  selectedRoute,
  isEmergency = false,
  currentLocationName = 'Your Current Location',
  onStartNavigation,
  onCallFacility,
  className = '',
}: RouteSummaryProps) => (
  <div className={`space-y-4 ${className}`}>
    {isEmergency && (
      <div role="alert" className="p-3 bg-rose-50/90 border border-rose-200/90 rounded-xl flex items-start gap-2.5 text-xs text-rose-950">
        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-rose-900 block">Emergency Navigation Route</span>
          <p className="text-[11px] text-rose-800 leading-relaxed">
            Prioritized route to the selected verified emergency facility. Facility intake and ambulance availability are not guaranteed.
          </p>
        </div>
      </div>
    )}

    <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {facility.emergencyAvailable ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200/80"><Flame className="w-3 h-3 text-rose-600" />Emergency Available</span>
          ) : (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">Urgent Care</span>
          )}
          {facility.verified && <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/80"><ShieldCheck className="w-3 h-3 text-emerald-600" />Verified</span>}
          <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded">{facility.openStatus || 'Open status unavailable'}</span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">Updated {facility.lastUpdated}</div>
      </div>

      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{facility.name}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{facility.address}</p>
      </div>

      <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-3 text-xs space-y-2">
        <div className="flex items-start gap-2.5">
          <CircleDot className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Current Location</span>
            <p className="text-slate-700 truncate font-medium">{currentLocationName}</p>
          </div>
        </div>
        <div className="border-l-2 border-dashed border-slate-300 ml-1.5 h-3" />
        <div className="flex items-start gap-2.5">
          <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Destination Facility</span>
            <p className="text-slate-900 truncate font-semibold">{facility.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 pt-1">
        <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-2.5 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Estimated Time</span>
          <div className="flex items-center justify-center gap-1 mt-0.5"><Clock className="w-3.5 h-3.5 text-blue-600" /><span className="text-base sm:text-lg font-bold text-slate-900">{selectedRoute.duration}</span></div>
        </div>
        <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-2.5 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Distance</span>
          <div className="flex items-center justify-center gap-1 mt-0.5"><Navigation className="w-3.5 h-3.5 text-slate-600" /><span className="text-base sm:text-lg font-bold text-slate-900">{selectedRoute.distance}</span></div>
        </div>
        <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-2.5 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Traffic Data</span>
          <span className="text-xs sm:text-sm font-bold text-slate-800 mt-1 block">{selectedRoute.trafficCondition === 'unknown' ? 'Unavailable' : selectedRoute.trafficCondition}</span>
        </div>
      </div>

      <div className="text-[10px] text-slate-600 flex items-center gap-1.5 pt-1">
        <Info className="w-3 h-3 text-slate-500 shrink-0" />
        <span>Route distance, ETA, and traffic-aware routing are provided by Google Maps Platform.</span>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
      <Button variant="secondary" size="lg" icon={<Phone className="w-4 h-4" />} onClick={onCallFacility} aria-label={`Call ${facility.name} at ${facility.phone}`} className="flex-1">Call Facility</Button>
      <Button variant={isEmergency ? 'emergency' : 'primary'} size="lg" icon={<Navigation className="w-4 h-4" />} onClick={onStartNavigation} aria-label={`Start navigation to ${facility.name}`} className="flex-1 font-bold"><span>Start Navigation</span><ArrowRight className="w-4 h-4 ml-1" /></Button>
    </div>
  </div>
);
