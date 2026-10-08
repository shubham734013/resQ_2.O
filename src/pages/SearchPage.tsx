import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { List, Map as MapIcon, ShieldAlert } from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import { FacilityFilterChips } from '../components/facility/FacilityFilterChips';
import { FacilityList } from '../components/facility/FacilityList';
import { FacilityPreview } from '../components/facility/FacilityPreview';
import { useFacilities } from '../hooks/useFacilities';
import { MapView } from '../components/map/MapView';
import type { Facility, FacilityCategory, UserLocation } from '../types/facility';

interface LayoutContext {
  currentLocation: UserLocation;
  refreshLocation: () => void;
  isUpdating: boolean;
}

const QUICK_TERMS = ['Hospital', 'Emergency', 'Trauma', 'Clinic', 'City Hospital'];

export const SearchPage = () => {
  const { currentLocation, refreshLocation } = useOutletContext<LayoutContext>();
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<FacilityCategory>('all');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  const hasLocation = Number.isFinite(currentLocation.latitude)
    && Number.isFinite(currentLocation.longitude)
    && (currentLocation.latitude !== 0 || currentLocation.longitude !== 0);

  const {
    facilities,
    selectedFacility,
    selectedFacilityId,
    setSelectedFacilityId,
    isLoading,
    isSearching,
    activeQuery,
  } = useFacilities({
    searchQuery,
    category,
    emergencyOnly,
    latitude: hasLocation ? currentLocation.latitude : undefined,
    longitude: hasLocation ? currentLocation.longitude : undefined,
    radiusMeters: 50000,
  });

  const handleClear = () => {
    setSearchQuery('');
    setCategory('all');
    setEmergencyOnly(false);
  };

  const mapMarkers = useMemo(
    () => facilities
      .filter((facility) => Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude))
      .map((facility) => ({
        id: facility.id,
        latitude: facility.latitude,
        longitude: facility.longitude,
        title: facility.name,
        subtitle: facility.openStatus,
        isEmergency: facility.emergencyAvailable,
        onClick: () => setSelectedFacilityId(facility.id),
      })),
    [facilities, setSelectedFacilityId],
  );

  const mapCenter = hasLocation
    ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
    : facilities[0]
      ? { latitude: facilities[0].latitude, longitude: facilities[0].longitude }
      : undefined;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.75rem)] overflow-hidden bg-slate-100">
      <div className="hidden md:flex flex-1 h-full overflow-hidden">
        <aside
          aria-label="Healthcare facilities finder"
          className="w-[420px] lg:w-[460px] shrink-0 bg-white border-r border-slate-200/90 flex flex-col h-full shadow-xs z-10"
        >
          <div className="p-4 border-b border-slate-100 space-y-3 bg-white shrink-0">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search hospitals, trauma, urgent care..."
              onClear={() => setSearchQuery('')}
            />

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
                  <button
                    key={term}
                    type="button"
                    onClick={() => setSearchQuery(term)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span>
              <strong className="text-slate-800">{facilities.length}</strong>{' '}
              {activeQuery ? 'matching facilities' : 'facilities nearby'}
            </span>
            <span>Verified directory</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selectedFacility && (
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  <span>Selected Facility</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFacilityId(null)}
                    className="text-slate-400 hover:text-slate-700 font-normal lowercase tracking-normal"
                  >
                    dismiss
                  </button>
                </div>
                <FacilityPreview
                  facility={selectedFacility}
                  onClose={() => setSelectedFacilityId(null)}
                />
              </div>
            )}

            <FacilityList
              facilities={facilities}
              selectedFacilityId={selectedFacilityId}
              onSelectFacility={(facility: Facility) => setSelectedFacilityId(facility.id)}
              isLoading={isLoading}
              isSearching={isSearching}
              activeQuery={activeQuery}
              onClearSearch={handleClear}
              onSelectQuerySuggestion={setSearchQuery}
            />
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-600 flex items-center gap-2 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
            <p className="truncate">
              ResQ coordinates navigation & care access. It does not diagnose medical conditions.
            </p>
          </div>
        </aside>

        <section aria-label="Map view" className="flex-1 h-full min-w-0 relative overflow-hidden bg-slate-200">
          <MapView
            center={mapCenter}
            userLocation={hasLocation ? currentLocation : undefined}
            markers={mapMarkers}
            interactive
            onRecenter={refreshLocation}
          />

          {!hasLocation && (
            <div className="absolute left-3 top-3 z-30 rounded-lg border border-amber-200 bg-white/95 px-3 py-2 text-xs text-amber-900 shadow-md">
              Location unavailable — allow browser location access to center the map on you.
            </div>
          )}
        </section>
      </div>

      <div className="md:hidden flex-1 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 z-20 p-2 space-y-2 pointer-events-none">
          <div className="pointer-events-auto shadow-md rounded-lg">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
              placeholder="Search hospitals or care..."
            />
          </div>

          <div className="pointer-events-auto">
            <FacilityFilterChips
              activeCategory={category}
              onSelectCategory={setCategory}
              emergencyOnly={emergencyOnly}
              onToggleEmergencyOnly={() => setEmergencyOnly((value) => !value)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileView((value) => value === 'map' ? 'list' : 'map')}
          className="absolute right-3 top-24 z-30 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-md"
          aria-label={mobileView === 'map' ? 'Switch to list view' : 'Switch to map view'}
        >
          {mobileView === 'map' ? <><List className="w-3.5 h-3.5" />List ({facilities.length})</> : <><MapIcon className="w-3.5 h-3.5" />Map</>}
        </button>

        {mobileView === 'map' ? (
          <div className="absolute inset-0">
            <MapView
              center={mapCenter}
              userLocation={hasLocation ? currentLocation : undefined}
              markers={mapMarkers}
              interactive
              onRecenter={refreshLocation}
            />

            {selectedFacility && (
              <div className="absolute bottom-2 left-2 right-2 z-30">
                <FacilityPreview
                  facility={selectedFacility}
                  onClose={() => setSelectedFacilityId(null)}
                  isFloating
                />
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto bg-slate-50 px-3 pt-28 pb-4">
            <FacilityList
              facilities={facilities}
              selectedFacilityId={selectedFacilityId}
              onSelectFacility={(facility: Facility) => {
                setSelectedFacilityId(facility.id);
                setMobileView('map');
              }}
              isLoading={isLoading}
              isSearching={isSearching}
              activeQuery={activeQuery}
              onClearSearch={handleClear}
              onSelectQuerySuggestion={setSearchQuery}
            />
          </div>
        )}
      </div>
    </div>
  );
};
