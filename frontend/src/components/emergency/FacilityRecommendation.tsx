import { Navigation, Clock, ShieldCheck, Flame, ArrowRight, ExternalLink } from 'lucide-react';
import type { FacilityRecommendationItem } from '../../types/emergency';
import { RecommendationReason } from './RecommendationReason';

export interface FacilityRecommendationProps {
  item: FacilityRecommendationItem;
  isPrimary?: boolean;
  onSelect: (item: FacilityRecommendationItem) => void;
  onViewDetails: (item: FacilityRecommendationItem) => void;
  className?: string;
}

export const FacilityRecommendation = ({
  item,
  isPrimary = false,
  onSelect,
  onViewDetails,
  className = '',
}: FacilityRecommendationProps) => {
  const { facility, reason, highlightCapability } = item;

  return (
    <article
      aria-label={`Recommended facility: ${facility.name}`}
      className={`rounded-2xl p-5 sm:p-6 text-left transition-all space-y-4 backdrop-blur-xl ${
        isPrimary
          ? 'border-2 border-rose-500/60 ring-2 ring-rose-500/20 bg-rose-500/[0.05] shadow-xl shadow-rose-950/40'
          : 'border border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
      } ${className}`}
    >
      {/* Top Tag & Proximity Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isPrimary && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-950/60 font-mono">
                <span>TOP MATCH</span>
              </span>
            )}
            {facility.emergencyAvailable && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30">
                <Flame className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                <span>Emergency available</span>
              </span>
            )}
            {!facility.emergencyAvailable && facility.isAvailable && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>Limited emergency intake</span>
              </span>
            )}
            {facility.verified && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>Verified ABDM Partner</span>
              </span>
            )}
            <span className="text-[11px] text-zinc-300 font-medium bg-white/[0.04] px-2.5 py-0.5 rounded-lg border border-white/10">
              {highlightCapability}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
            {facility.name}
          </h3>
          <p className="text-xs text-zinc-400 truncate max-w-lg">{facility.address}</p>
        </div>

        {/* Distance & ETA Stat Pill in Monospace */}
        <div className="text-right shrink-0 bg-white/[0.04] border border-white/10 rounded-2xl px-3.5 py-2.5 shadow-md">
          <div className="flex items-center gap-1.5 text-white font-mono font-bold text-sm sm:text-base justify-end">
            <Navigation className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
            <span>{facility.distance}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400 justify-end mt-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{facility.estimatedTime}</span>
          </div>
        </div>
      </div>

      {facility.distanceType === 'STRAIGHT_LINE' && (
        <p className="text-[11px] text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 font-medium">
          Straight-line distance only; driving route/ETA unavailable.
        </p>
      )}

      {/* Recommendation Explanation */}
      <RecommendationReason reason={reason} />

      {/* Footer Info & Actions */}
      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-mono text-zinc-500 font-medium">
          Telemetry updated {facility.lastUpdated}
        </span>

        <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onViewDetails(item)}
            aria-label={`View details for ${facility.name}`}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] hover:text-white transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View details</span>
          </button>

          <button
            type="button"
            onClick={() => onSelect(item)}
            aria-label={`Select ${facility.name} for coordination`}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-950/60 transition cursor-pointer active:scale-95"
          >
            <span>Select Hospital</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
