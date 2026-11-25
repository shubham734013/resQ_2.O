import { Navigation, Clock, Building2, ShieldCheck, Flame, MapPin, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Facility } from '../../types/facility';
import { ROUTES } from '../../routes/routePaths';

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
      className={`group relative rounded-2xl p-6 transition-all duration-300 text-left cursor-pointer select-none space-y-4 shadow-xl outline-none ${
        isSelected
          ? 'bg-rose-500/[0.08] backdrop-blur-xl border border-rose-500/40 ring-1 ring-rose-500/30 shadow-2xl shadow-rose-950/40'
          : 'bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
      } ${className}`}
    >
      {/* Top row: Badges and distance telemetry */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            {facility.emergencyAvailable && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 shadow-xs">
                <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-hidden="true" />
                <span>24/7 Emergency</span>
              </span>
            )}
            {facility.verified && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Verified</span>
              </span>
            )}
            {facility.openStatus && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] text-zinc-300 border border-white/10">
                <Clock className="w-3 h-3 text-zinc-400 shrink-0" aria-hidden="true" />
                <span>{facility.openStatus}</span>
              </span>
            )}
          </div>

          {/* Facility Name & Type */}
          <h3 className="text-lg font-light text-zinc-100 tracking-tight group-hover:text-white transition-colors truncate">
            {facility.name}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 truncate">
            <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="truncate">{facility.type || 'Healthcare Facility'}</span>
            {facility.triageWaitTime && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">{facility.triageWaitTime} wait</span>
              </>
            )}
          </p>
        </div>

        {/* Distance Telemetry Pill */}
        <div className="text-right shrink-0 bg-zinc-900/80 text-zinc-300 border border-white/10 rounded-lg px-3 py-1.5 shadow-md">
          <div className="flex items-center gap-1 text-zinc-200 font-mono font-bold text-xs justify-end">
            <Navigation className="w-3 h-3 text-rose-400" aria-hidden="true" />
            <span>{facility.distance}</span>
          </div>
          {facility.estimatedTime && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 justify-end mt-0.5">
              <Clock className="w-3 h-3 text-zinc-500" aria-hidden="true" />
              <span>{facility.estimatedTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* Service / Capabilities Tags */}
      {facility.capabilities && facility.capabilities.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {facility.capabilities.slice(0, 4).map((cap, idx) => (
            <span
              key={idx}
              className="bg-white/[0.04] text-zinc-400 border border-white/5 text-[11px] px-2.5 py-1 rounded-lg truncate max-w-[150px]"
            >
              {cap}
            </span>
          ))}
          {facility.capabilities.length > 4 && (
            <span className="text-[11px] font-mono text-zinc-500 px-1.5 py-0.5">
              +{facility.capabilities.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Bottom row: Address & Direct Action Trigger */}
      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 truncate text-zinc-400 max-w-[65%]">
          <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="truncate">{facility.address}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(ROUTES.USER.HOSPITAL_DETAIL(facility.id));
          }}
          aria-label={`View full details for ${facility.name}`}
          className="text-rose-400 hover:text-rose-300 text-sm font-medium tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ml-2"
        >
          <span>View Facility</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};
