import { Navigation, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Facility } from '../../types/facility';
import { StatusBadge } from '../common/StatusBadge';

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
      className={`group p-4 rounded-lg border transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
        isSelected
          ? 'bg-slate-50/90 border-slate-900/40 shadow-xs ring-1 ring-slate-900/10'
          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {facility.emergencyAvailable && (
              <StatusBadge variant="emergency" size="sm" label="Emergency available" />
            )}
            {facility.verified && <StatusBadge variant="verified" size="sm" label="Verified" />}
            {facility.triageWaitTime && (
              <StatusBadge
                variant="waitTime"
                size="sm"
                label={facility.triageWaitTime}
              />
            )}
          </div>

          <h3 className="font-semibold text-slate-900 text-sm md:text-base leading-snug group-hover:text-slate-950 truncate">
            {facility.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{facility.type}</p>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-slate-900 font-semibold text-xs md:text-sm justify-end">
            <Navigation className="w-3 h-3 text-slate-500" aria-hidden="true" />
            <span>{facility.distance}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 justify-end mt-0.5">
            <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <span>{facility.estimatedTime}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 truncate">
          <span className="truncate">{facility.address}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/facility/${facility.id}`);
          }}
          aria-label={`View full details for ${facility.name}`}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-950 shrink-0 ml-2 group-hover:text-slate-900 transition-colors p-1 rounded hover:bg-slate-100 cursor-pointer"
        >
          <span className="text-[11px] font-semibold hidden sm:inline">Details</span>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};
