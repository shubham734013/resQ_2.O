import { MapPin, RefreshCw } from 'lucide-react';
import type { UserLocation } from '../../types/facility';

export interface LocationIndicatorProps {
  location: UserLocation;
  isUpdating?: boolean;
  onRefresh?: () => void;
  className?: string;
  compact?: boolean;
}

export const LocationIndicator = ({
  location,
  isUpdating = false,
  onRefresh,
  className = '',
  compact = false,
}: LocationIndicatorProps) => {
  return (
    <div
      className={`inline-flex items-center gap-2 text-xs text-slate-700 bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-lg px-2.5 py-1.5 shadow-xs select-none ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5 text-slate-600 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <MapPin className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
      </div>

      <div className="flex flex-col min-w-0">
        {!compact && (
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-600 leading-tight">
            Current Location
          </span>
        )}
        <span className="font-medium text-slate-800 truncate text-xs leading-tight">
          {location.label}
        </span>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isUpdating}
          aria-label="Refresh current location"
          className="ml-auto p-1 text-slate-400 hover:text-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin text-slate-700' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
};
