import { useCallback, useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  List,
  Map as MapIcon,
  ShieldAlert,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import { FacilityFilterChips } from '../components/facility/FacilityFilterChips';
import { FacilityList } from '../components/facility/FacilityList';
import { FacilityPreview } from '../components/facility/FacilityPreview';
import { MapView } from '../components/map/MapView';
import { useNearbyFacilities } from '../hooks/useNearbyFacilities';
import { useFacilities } from '../hooks/useFacilities';
import type { Facility, FacilityCategory, UserLocation } from '../types/facility';

interface LayoutContext {
  currentLocation: UserLocation;
  refreshLocation: () => void;
  isUpdating: boolean;
}

export const HomePage = () => {
  const navigate = useNavigate();
  const { currentLocation, refreshLocation } = useOutletContext<LayoutContext>();
  const hasLocation = Number.isFinite(currentLocation.latitude) && Number.isFinite(currentLocation.longitude) && (currentLocation.latitude !== 0 || currentLocation.longitude !== 0);
  const nearby = useNearbyFacilities(hasLocation ? currentLocation.latitude : null, hasLocation ? currentLocation.longitude : null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<FacilityCategory>('all');
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  // Mobile View Toggle: 'map' or 'list'
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  // Query facilities using TanStack Query hook with smart debounced search
  const {
    facilities,
    selectedFacility,
    selectedFacilityId,
    setSelectedFacilityId,
    isLoading,
    isSearching,
    isError,
    error,
    refetch,
    activeQuery,
  } = useFacilities({
    searchQuery,
    category,
    emergencyOnly,
  });

  const handleSelectFacility = useCallback((facility: Facility) => {
    setSelectedFacilityId(facility.id);
  }, [setSelectedFacilityId]);

  const handleDismissSelection = () => {
    setSelectedFacilityId(null);
  };

  const handleToggleEmergency = () => {
    setEmergencyOnly((prev) => !prev);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setCategory('all');
    setEmergencyOnly(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
  };

  const locatedFacilities = facilities.filter((facility): facility is Facility & { latitude: number; longitude: number } =>
    typeof facility.latitude === 'number' && typeof facility.longitude === 'number'
  );
  const nearbyLocated = (nearby.data?.items ?? []).filter((item): item is typeof item & { latitude: number; longitude: number } =>
    typeof item.latitude === 'number' && typeof item.longitude === 'number'
  );
  const mapMarkers = useMemo(() => {
    if (nearbyLocated.length > 0) {
      return nearbyLocated.map((item) => ({
        id: item.id,
        latitude: item.latitude,
        longitude: item.longitude,
        title: item.name,
        subtitle: item.emergencyAvailability,
        isEmergency: item.emergencyAvailability === 'AVAILABLE',
        onClick: () => {
          const facility = facilities.find((candidate) => candidate.id === item.id);
          if (facility) handleSelectFacility(facility);
        },
      }));
    }
    return locatedFacilities.map((facility) => ({
      id: facility.id,
      latitude: facility.latitude,
      longitude: facility.longitude,
      title: facility.name,
      subtitle: facility.openStatus,
      isEmergency: facility.emergencyAvailable,
      onClick: () => handleSelectFacility(facility),
    }));
  }, [nearbyLocated, locatedFacilities, facilities, handleSelectFacility]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* ========================================================
          DESKTOP & TABLET LAYOUT (Split View: Master-Detail + Map)
          ======================================================== */}
      <div className="hidden md:flex flex-1 h-full overflow-hidden">
        {/* Left Side: Search, Filters, Facilities List & Preview */}
        <aside
          aria-label="Healthcare facilities finder"
          className="w-[430px] lg:w-[480px] shrink-0 bg-white border-r border-slate-200/90 flex flex-col h-full shadow-xs z-10"
        >
          {/* Top Panel: Quick Navigation & Search */}
          <div className="p-4 border-b border-slate-100 space-y-2.5 bg-white shrink-0">
            {/* Enterprise Healthcare Network Live Ticker */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white flex items-center justify-between text-[11px] shadow-xs">
              <div className="flex items-center gap-1.5 font-bold text-teal-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ResQ Network Active</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 text-[10px] font-medium">
                <span>Target: 4.2m Dispatch SLA</span>
                <span className="text-slate-600">•</span>
                <span>99.99% Platform Uptime (Benchmark)</span>
              </div>
            </div>

            {/* Quick Emergency & Care Action Cards */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate('/sos')}
                className="resq-emergency-pulse p-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center gap-2.5 text-left cursor-pointer shadow-sm hover:from-red-700 hover:to-rose-800 transition-all active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-black block leading-tight">Emergency SOS</span>
                  <span className="text-[10px] text-white/80 block truncate font-medium">1-Click Dispatch</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/appointments')}
                className="p-2.5 rounded-xl bg-teal-50/80 hover:bg-teal-100/70 border border-teal-200/80 text-teal-950 flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-xs active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold block leading-tight">Care & Visits</span>
                  <span className="text-[10px] text-teal-700 block truncate font-medium">Book or Track</span>
                </div>
              </button>
            </div>

            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search hospitals, trauma, specialty care..."
              onClear={() => setSearchQuery('')}
            />

            <FacilityFilterChips
              activeCategory={category}
              onSelectCategory={setCategory}
              emergencyOnly={emergencyOnly}
              onToggleEmergencyOnly={handleToggleEmergency}
            />
          </div>

          {/* Results Summary Bar */}
          <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-800">
                {facilities.length}
              </span>
              <span>
                {activeQuery ? 'matching facilities' : 'facilities nearby'}
              </span>
              {emergencyOnly && (
                <span className="text-rose-700 font-medium">(24/7 ER)</span>
              )}
            </div>
            <span className="text-[11px] text-slate-500">Sorted by distance</span>
          </div>

          {/* Scrollable Facility Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
            {/* Active Selected Facility Preview (Desktop/Tablet) */}
            {selectedFacility && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  <span>Selected Facility</span>
                  <button
                    type="button"
                    onClick={handleDismissSelection}
                    className="text-slate-400 hover:text-slate-700 font-normal lowercase tracking-normal cursor-pointer"
                  >
                    dismiss
                  </button>
                </div>
                <FacilityPreview
                  facility={selectedFacility}
                  onClose={handleDismissSelection}
                />
              </div>
            )}

            {/* List of nearby or filtered facilities */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                {activeQuery ? 'Search Results' : 'All Nearby Locations'}
              </div>
              <FacilityList
                facilities={facilities}
                selectedFacilityId={selectedFacilityId}
                onSelectFacility={handleSelectFacility}
                isLoading={isLoading}
                isSearching={isSearching}
                errorMessage={isError ? error.message : undefined}
                onRetry={() => void refetch()}
                activeQuery={activeQuery}
                onClearSearch={handleClearSearch}
                onSelectQuerySuggestion={handleSuggestionClick}
              />
            </div>
          </div>

          {/* Minimalist Medical Disclaimer (Desktop Left Footer) */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-600 flex items-center gap-2 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
            <p className="truncate">
              ResQ coordinates navigation & care access. Does not diagnose medical conditions.
            </p>
          </div>
        </aside>

        {/* Right Side: Interactive Map-First Canvas */}
        <section
          aria-label="Map view"
          className="flex-1 h-full relative overflow-hidden bg-slate-200"
        >
          <MapView
            center={hasLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : (locatedFacilities[0] ? { latitude: locatedFacilities[0].latitude, longitude: locatedFacilities[0].longitude } : undefined)}
            userLocation={hasLocation ? currentLocation : undefined}
            markers={mapMarkers}
            interactive
            className="w-full h-full min-h-[400px]"
            onRecenter={refreshLocation}
          />
        </section>
      </div>

      {/* ========================================================
          MOBILE LAYOUT (< 768px: True Map-First + Responsive Sheet)
          ======================================================== */}
      <div className="md:hidden flex-1 flex flex-col relative h-[calc(100vh-3.75rem-4rem)] overflow-hidden">
        {/* Floating Top Controls (Search & Quick Filter) */}
        <div className="absolute top-2 left-2 right-2 z-20 space-y-2 pointer-events-none">
          <div className="pointer-events-auto shadow-md rounded-lg">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search hospitals or care..."
              onClear={() => setSearchQuery('')}
            />
          </div>

          <div className="pointer-events-auto bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-xs">
            <FacilityFilterChips
              activeCategory={category}
              onSelectCategory={setCategory}
              emergencyOnly={emergencyOnly}
              onToggleEmergencyOnly={handleToggleEmergency}
            />
          </div>
        </div>

        {/* Floating Mobile View Toggle (Map / List) */}
        <div className="absolute top-28 right-3 z-20">
          <button
            type="button"
            onClick={() => setMobileView((v) => (v === 'map' ? 'list' : 'map'))}
            aria-label={`Switch to ${mobileView === 'map' ? 'list view' : 'map view'}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-full text-xs font-semibold shadow-md active:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer"
          >
            {mobileView === 'map' ? (
              <>
                <List className="w-3.5 h-3.5" aria-hidden="true" />
                <span>List ({facilities.length})</span>
              </>
            ) : (
              <>
                <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Map</span>
              </>
            )}
          </button>
        </div>

        {/* View Mode: Map */}
        {mobileView === 'map' && (
          <div className="relative w-full h-full flex flex-col">
            {/* Map Canvas */}
            <div className="flex-1 w-full h-full">
              <MapView
                center={hasLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : (locatedFacilities[0] ? { latitude: locatedFacilities[0].latitude, longitude: locatedFacilities[0].longitude } : undefined)}
                userLocation={hasLocation ? currentLocation : undefined}
                markers={mapMarkers}
                interactive
                className="w-full h-full min-h-[350px]"
                onRecenter={refreshLocation}
              />
            </div>

            {/* Selected Facility Card (Docks over map as bottom sheet) */}
            {selectedFacility ? (
              <div className="absolute bottom-2 left-2 right-2 z-30">
                <FacilityPreview
                  facility={selectedFacility}
                  onClose={handleDismissSelection}
                  isFloating
                />
              </div>
            ) : (
              /* Bottom Peek Bar when no facility selected */
              <div className="absolute bottom-2 left-2 right-2 z-20">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="w-full bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl px-4 py-2.5 shadow-md flex items-center justify-between text-xs text-slate-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-slate-900">
                      {facilities.length} healthcare facilities nearby
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 font-medium">
                    <span>View list</span>
                    <ChevronUp className="w-4 h-4" />
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* View Mode: List */}
        {mobileView === 'list' && (
          <div className="flex-1 overflow-y-auto bg-slate-50 pt-28 px-3 pb-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="font-semibold text-slate-800">
                {facilities.length} {activeQuery ? 'matching facilities' : 'facilities nearby'}
              </span>
              <span>Sorted by distance</span>
            </div>

            {/* Selected Facility Preview if present */}
            {selectedFacility && (
              <div className="mb-2">
                <FacilityPreview
                  facility={selectedFacility}
                  onClose={handleDismissSelection}
                />
              </div>
            )}

            <FacilityList
              facilities={facilities}
              selectedFacilityId={selectedFacilityId}
              onSelectFacility={(fac) => {
                handleSelectFacility(fac);
                // Switch to map view to show pin and preview
                setMobileView('map');
              }}
              isLoading={isLoading}
              isSearching={isSearching}
              errorMessage={isError ? error.message : undefined}
              onRetry={() => void refetch()}
              activeQuery={activeQuery}
              onClearSearch={handleClearSearch}
              onSelectQuerySuggestion={handleSuggestionClick}
            />
          </div>
        )}
      </div>
    </div>
  );
};
