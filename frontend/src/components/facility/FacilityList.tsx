import type { Facility } from '../../types/facility';
import { FacilityCard } from './FacilityCard';
import { Search, Loader2 } from 'lucide-react';

export interface FacilityListProps {
  facilities: Facility[];
  selectedFacilityId: string | null;
  onSelectFacility: (facility: Facility) => void;
  isLoading?: boolean;
  isSearching?: boolean;
  activeQuery?: string;
  onClearSearch?: () => void;
  onSelectQuerySuggestion?: (query: string) => void;
  className?: string;
  errorMessage?: string;
  onRetry?: () => void;
}

const COMMON_SUGGESTIONS = [
  'Hospital',
  '24/7 Emergency',
  'Trauma',
  'Clinic',
  'City Hospital',
];

export const FacilityList = ({
  facilities,
  selectedFacilityId,
  onSelectFacility,
  isLoading = false,
  isSearching = false,
  activeQuery = '',
  onClearSearch,
  onSelectQuerySuggestion,
  className = '',
  errorMessage,
  onRetry,
}: FacilityListProps) => {
  // Searching / Loading Skeleton State
  if (isLoading || isSearching) {
    return (
      <div className={`space-y-4 py-2 ${className}`}>
        <div className="flex items-center gap-2.5 text-xs text-zinc-400 py-1 font-mono">
          <Loader2 className="w-4 h-4 animate-spin text-rose-500 shrink-0" />
          <span>Locating verified healthcare facilities…</span>
        </div>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-36 bg-white/[0.02] rounded-2xl animate-pulse border border-white/10"
          />
        ))}
      </div>
    );
  }

  // Error State
  if (errorMessage) {
    return (
      <div
        role="alert"
        className={`p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-3.5 backdrop-blur-md ${className}`}
      >
        <h4 className="font-semibold text-rose-300 text-sm">Unable to load healthcare facilities</h4>
        <p className="text-xs text-rose-400/90 leading-relaxed max-w-sm mx-auto">{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 transition-all cursor-pointer"
          >
            Retry Search
          </button>
        )}
      </div>
    );
  }

  // No Results State
  if (facilities.length === 0) {
    return (
      <div
        className={`p-8 text-center bg-white/[0.02] border border-white/10 rounded-2xl space-y-4 backdrop-blur-md ${className}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
          <Search className="w-5 h-5 text-zinc-400" />
        </div>

        <div>
          <h4 className="font-medium text-zinc-100 text-base">
            {activeQuery ? `No facilities found for "${activeQuery}"` : 'No matching facilities'}
          </h4>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-xs mx-auto leading-relaxed font-light">
            We couldn't find any medical centers matching your current search query or active filters.
          </p>
        </div>

        {/* Search Suggestions */}
        {onSelectQuerySuggestion && (
          <div className="pt-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-2.5">
              Try searching for
            </span>
            <div className="flex flex-wrap justify-center gap-1.5">
              {COMMON_SUGGESTIONS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onSelectQuerySuggestion(term)}
                  className="text-xs bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {onClearSearch && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onClearSearch}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer transition-colors"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>
    );
  }

  // Facilities List
  return (
    <div className={`space-y-4 ${className}`}>
      {facilities.map((facility) => (
        <FacilityCard
          key={facility.id}
          facility={facility}
          isSelected={facility.id === selectedFacilityId}
          onSelect={onSelectFacility}
        />
      ))}
    </div>
  );
};
