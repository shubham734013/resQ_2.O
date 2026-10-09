import type { Facility } from '../../types/facility';
import { FacilityCard } from './FacilityCard';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '../common/Button';

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
  // Searching / Loading State
  if (isLoading || isSearching) {
    return (
      <div className={`space-y-3 py-2 ${className}`}>
        <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
          <span>Searching matching healthcare facilities...</span>
        </div>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-24 bg-slate-100 rounded-lg animate-pulse border border-slate-200/60"
          />
        ))}
      </div>
    );
  }

  // Distinguish API failures from a successful search with no matches.
  if (errorMessage) {
    return (
      <div role="alert" className={`p-6 sm:p-8 text-center bg-rose-50 border border-rose-200 rounded-xl space-y-3 ${className}`}>
        <h4 className="font-semibold text-rose-900 text-sm">Unable to load healthcare facilities</h4>
        <p className="text-xs text-rose-800">{errorMessage}</p>
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
      </div>
    );
  }

  // No Results State
  if (facilities.length === 0) {
    return (
      <div className={`p-6 sm:p-8 text-center bg-white border border-slate-200 rounded-xl space-y-4 ${className}`}>
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Search className="w-5 h-5 text-slate-500" />
        </div>

        <div>
          <h4 className="font-semibold text-slate-900 text-sm">
            {activeQuery ? `No facilities found for "${activeQuery}"` : 'No matching facilities'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            We couldn't find any healthcare centers matching your current search or filters.
          </p>
        </div>

        {/* Search Suggestions */}
        {onSelectQuerySuggestion && (
          <div className="pt-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-2">
              Try searching for
            </span>
            <div className="flex flex-wrap justify-center gap-1.5">
              {COMMON_SUGGESTIONS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onSelectQuerySuggestion(term)}
                  className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {onClearSearch && (
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSearch}
            >
              Reset search & filters
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Results State
  return (
    <div
      role="region"
      aria-label="Nearby healthcare facilities list"
      className={`space-y-2.5 ${className}`}
    >
      {facilities.map((fac) => (
        <FacilityCard
          key={fac.id}
          facility={fac}
          isSelected={selectedFacilityId === fac.id}
          onSelect={onSelectFacility}
        />
      ))}
    </div>
  );
};
