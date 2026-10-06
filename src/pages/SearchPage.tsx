import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/search/SearchBar';
import { FacilityFilterChips } from '../components/facility/FacilityFilterChips';
import { FacilityList } from '../components/facility/FacilityList';
import { FacilityPreview } from '../components/facility/FacilityPreview';
import { useFacilities } from '../hooks/useFacilities';
import type { Facility, FacilityCategory } from '../types/facility';

const QUICK_TERMS = ['Hospital', 'Emergency', 'Trauma', 'Clinic', 'City Hospital'];

export const SearchPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<FacilityCategory>('all');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const { facilities, selectedFacility, selectedFacilityId, setSelectedFacilityId, isLoading, isSearching, activeQuery } = useFacilities({
    searchQuery,
    category,
    emergencyOnly,
  });

  const handleClear = () => {
    setSearchQuery('');
    setCategory('all');
    setEmergencyOnly(false);
  };

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Find Healthcare Facilities</h1>
        <p className="text-sm text-slate-500">Search verified hospitals, trauma centers, and urgent care clinics.</p>
      </header>

      <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <SearchBar value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery('')} autoFocus placeholder="Search hospitals, trauma, urgent care..." />
        <FacilityFilterChips
          activeCategory={category}
          onSelectCategory={setCategory}
          emergencyOnly={emergencyOnly}
          onToggleEmergencyOnly={() => setEmergencyOnly((value) => !value)}
        />
        {!searchQuery && (
          <div className="pt-1 flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
            <span className="text-[11px] font-medium text-slate-400">Popular:</span>
            {QUICK_TERMS.map((term) => (
              <button key={term} type="button" onClick={() => setSearchQuery(term)} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs">{term}</button>
            ))}
          </div>
        )}
      </div>

      {selectedFacility && (
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            <span>Selected Facility</span>
            <button type="button" onClick={() => setSelectedFacilityId(null)} className="text-slate-400 hover:text-slate-700 font-normal lowercase tracking-normal">dismiss</button>
          </div>
          <FacilityPreview facility={selectedFacility} onClose={() => setSelectedFacilityId(null)} />
        </div>
      )}

      <section aria-label="Search results" className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span className="font-semibold text-slate-800">{facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'} found</span>
          <span>Verified directory</span>
        </div>
        <FacilityList
          facilities={facilities}
          selectedFacilityId={selectedFacilityId}
          onSelectFacility={(facility: Facility) => navigate(`/facility/${facility.id}`)}
          isLoading={isLoading}
          isSearching={isSearching}
          activeQuery={activeQuery}
          onClearSearch={handleClear}
          onSelectQuerySuggestion={(query) => setSearchQuery(query)}
        />
      </section>
    </div>
  );
};
