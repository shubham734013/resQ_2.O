import { CheckCircle2, Clock, Navigation, AlertCircle } from 'lucide-react';
import type { RouteOptionItem } from '../../types/route';

export interface RouteOptionProps {
  route: RouteOptionItem;
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
}

export const RouteOption = ({
  route,
  isSelected,
  onSelect,
  className = '',
}: RouteOptionProps) => {
  const getTrafficBadge = () => {
    switch (route.trafficCondition) {
      case 'light':
        return (
          <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded">
            Light traffic
          </span>
        );
      case 'moderate':
        return (
          <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded">
            Moderate traffic
          </span>
        );
      case 'heavy':
        return (
          <span className="text-[11px] font-medium text-rose-800 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Heavy traffic
          </span>
        );
    }
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
        isSelected
          ? 'bg-blue-50/50 border-blue-600 shadow-xs ring-1 ring-blue-600/30'
          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Badge & Route Via Name */}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            {route.isRecommended ? (
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100/80 border border-blue-200 px-2 py-0.5 rounded">
                Recommended
              </span>
            ) : (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                Alternative
              </span>
            )}
            {getTrafficBadge()}
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
            {route.viaRoute}
          </p>
          <p className="text-[11px] text-slate-500 line-clamp-1">
            {route.summary}
          </p>
        </div>

        {/* Right: Time, Distance, & Selected Check */}
        <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch">
          <div className="flex items-center gap-1.5">
            <div className="text-right">
              <span className="text-sm sm:text-base font-bold text-slate-950 block leading-tight">
                {route.duration}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {route.distance}
              </span>
            </div>
            <div className="ml-1">
              {isSelected ? (
                <CheckCircle2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
              ) : (
                <div className="w-5 h-5 rounded-full border border-slate-300" aria-hidden="true" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-2">
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              ETA
            </span>
            <span className="flex items-center gap-0.5">
              <Navigation className="w-3 h-3" />
              Direct
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};
