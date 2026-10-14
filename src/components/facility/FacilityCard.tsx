import { Navigation, Clock, ChevronRight, Building2, ShieldCheck, Flame, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Facility } from '../../types/facility';

export interface FacilityCardProps {
  facility: Facility;
  isSelected?: boolean;
  onSelect: (facility: Facility) => void;
  className?: string;
}

export const FacilityCard = ({
  facility,
  isSelected = false,
  onSelect,
  className = '',
}: FacilityCardProps) => {
  const navigate = useNavigate();

  return (
    <article
      onClick={() => onSelect(facility)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(facility);
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${facility.name}, ${facility.type}, ${facility.distance} away`}
      className={`group p-4 rounded-xl transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 relative overflow-hidden ${
        isSelected
          ? 'bg-teal-50/50 border-2 border-teal-600 shadow-sm ring-1 ring-teal-600/20'
          : 'resq-card-hover'
      } ${className}`}
    >
      {/* Top row: Badges and distance */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {facility.emergencyAvailable && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                <Flame className="w-3 h-3 text-rose-600 shrink-0" aria-hidden="true" />
                24/7 Emergency
              </span>
            )}
            {facility.verified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
                Verified
              </span>
            )}
            {facility.triageWaitTime && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                <Clock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                {facility.triageWaitTime}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <h3 className="font-bold text-slate-950 text-sm md:text-base leading-snug group-hover:text-teal-900 transition-colors truncate">
              {facility.name}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{facility.type}</span>
          </p>
        </div>

        {/* Distance & Driving ETA Pill */}
        <div className="text-right shrink-0 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 shadow-2xs">
          <div className="flex items-center gap-1 text-slate-900 font-bold text-xs md:text-sm justify-end">
            <Navigation className="w-3 h-3 text-teal-600" aria-hidden="true" />
            <span>{facility.distance}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 justify-end mt-0.5">
            <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <span>{facility.estimatedTime}</span>
          </div>
        </div>
      </div>

      {/* Capabilities tags preview */}
      {facility.capabilities && facility.capabilities.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          {facility.capabilities.slice(0, 3).map((cap, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-slate-100/90 text-slate-600 rounded text-[11px] font-medium border border-slate-200/60 truncate max-w-[150px]"
            >
              {cap}
            </span>
          ))}
          {facility.capabilities.length > 3 && (
            <span className="text-[11px] text-slate-400 font-medium">
              +{facility.capabilities.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Bottom row: Address & Details Action */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5 truncate text-slate-500">
          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{facility.address}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/facility/${facility.id}`);
          }}
          aria-label={`View full details for ${facility.name}`}
          className="flex items-center gap-1 text-teal-700 hover:text-teal-900 font-bold shrink-0 ml-2 transition-colors px-2 py-1 rounded-md hover:bg-teal-50 cursor-pointer"
        >
          <span className="text-[11px] hidden sm:inline">View Facility</span>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};

