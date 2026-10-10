import { Navigation, Clock, ShieldCheck, Flame, ArrowRight, ExternalLink } from 'lucide-react';
import type { FacilityRecommendationItem } from '../../types/emergency';
import { RecommendationReason } from './RecommendationReason';
import { Button } from '../common/Button';

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
      className={`bg-white border rounded-xl p-4 sm:p-5 text-left transition-all shadow-xs space-y-3.5 ${
        isPrimary
          ? 'border-slate-900/30 ring-1 ring-slate-900/10'
          : 'border-slate-200/90 hover:border-slate-300'
      } ${className}`}
    >
      {/* Top Tag & Proximity Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {facility.emergencyAvailable && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200/80">
                <Flame className="w-3 h-3 text-rose-600" aria-hidden="true" />
                <span>Emergency available</span>
              </span>
            )}
            {!facility.emergencyAvailable && facility.isAvailable && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80">
                <Flame className="w-3 h-3 text-amber-600" aria-hidden="true" />
                <span>Limited emergency intake</span>
              </span>
            )}
            {facility.verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                <ShieldCheck className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                <span>Verified</span>
              </span>
            )}
            <span className="text-[11px] text-slate-500 font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
              {highlightCapability}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
            {facility.name}
          </h3>
          <p className="text-xs text-slate-500 truncate">{facility.address}</p>
        </div>

        {/* Distance & ETA Stat */}
        <div className="text-right shrink-0 bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1.5">
          <div className="flex items-center gap-1 text-slate-900 font-bold text-xs sm:text-sm justify-end">
            <Navigation className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
            <span>{facility.distance}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-600 justify-end mt-0.5">
            <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <span>{facility.estimatedTime}</span>
          </div>
        </div>
      </div>

      {facility.distanceType === 'STRAIGHT_LINE' && <p className="text-[11px] text-amber-700">Straight-line distance only; driving route/ETA unavailable.</p>}

      {/* Recommendation Explanation */}
      <RecommendationReason reason={reason} />

      {/* Footer Info & Actions */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-slate-400">
          Updated {facility.lastUpdated}
        </span>

        <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={() => onViewDetails(item)}
            aria-label={`View details for ${facility.name}`}
            className="flex-1 sm:flex-initial"
          >
            View details
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<ArrowRight className="w-3.5 h-3.5" />}
            iconPosition="right"
            onClick={() => onSelect(item)}
            aria-label={`Select ${facility.name} for coordination`}
            className="flex-1 sm:flex-initial font-semibold"
          >
            Select
          </Button>
        </div>
      </div>
    </article>
  );
};
