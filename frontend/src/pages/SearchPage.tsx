import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  List,
  Map as MapIcon,
  ShieldAlert,
  LocateFixed,
  Activity,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import { FacilityFilterChips } from '../components/facility/FacilityFilterChips';
import { FacilityList } from '../components/facility/FacilityList';
import { FacilityPreview } from '../components/facility/FacilityPreview';
import { useFacilities } from '../hooks/useFacilities';
import { MapView, darkMapStyle } from '../components/map/MapView';
import { DEFAULT_JAIPUR_COORDINATES } from '../types/maps';
import { useLocationState } from '../hooks/useLocationState';
import type { Facility, FacilityCategory, UserLocation } from '../types/facility';

interface LayoutContext {
  currentLocation: UserLocation;
  refreshLocation: () => void;
  isUpdating: boolean;
}

const QUICK_TERMS = ['Hospital', 'Emergency', 'Trauma', 'Clinic', 'City Hospital'];

export const SearchPage = () => {
  const outletContext = useOutletContext<LayoutContext | undefined>();
  const fallback = useLocationState();
  const currentLocation = outletContext?.currentLocation ?? fallback.currentLocation;
  const refreshLocation = outletContext?.refreshLocation ?? fallback.refreshLocation;
  const isUpdating = outletContext?.isUpdating ?? fallback.isUpdating;

  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<FacilityCategory>('all');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  const hasLocation =
    Number.isFinite(currentLocation.latitude) &&
    Number.isFinite(currentLocation.longitude) &&
    (currentLocation.latitude !== 0 || currentLocation.longitude !== 0);

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
    latitude: hasLocation ? currentLocation.latitude : undefined,
    longitude: hasLocation ? currentLocation.longitude : undefined,
    radiusMeters: 50000,
  });

  const handleClear = () => {
    setSearchQuery('');
    setCategory('all');
    setEmergencyOnly(false);
  };

  const locatedFacilities = facilities.filter(
    (facility): facility is Facility & { latitude: number; longitude: number } =>
      typeof facility.latitude === 'number' && typeof facility.longitude === 'number'
  );

  const mapMarkers = useMemo(
    () =>
      locatedFacilities.map((facility) => ({
        id: facility.id,
        type: 'HOSPITAL' as const,
        latitude: facility.latitude,
        longitude: facility.longitude,
        title: facility.name,
        subtitle: facility.openStatus,
        isEmergency: facility.emergencyAvailable,
        onClick: () => setSelectedFacilityId(facility.id),
      })),
    [locatedFacilities, setSelectedFacilityId]
  );

  const mapCenter = hasLocation
    ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
    : locatedFacilities[0]
    ? { latitude: locatedFacilities[0].latitude, longitude: locatedFacilities[0].longitude }
    : DEFAULT_JAIPUR_COORDINATES;

  return (
    <div className="relative flex-1 flex flex-col h-[calc(100vh-4.5rem)] overflow-hidden bg-[#070709] text-zinc-100 font-sans selection:bg-rose-500/20 selection:text-rose-200">
      {/* ─── Ambient Crimson/Amber Background Radiant Glows ────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full opacity-[0.07] blur-[140px]"
          style={{ background: 'radial-gradient(circle, #f43f5e 0%, #f59e0b 50%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 right-1/4 h-[500px] w-[500px] rounded-full opacity-[0.05] blur-[160px]"
          style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
        />
      </div>

      {/* ─── Desktop Dual-Panel Layout (45% Directory / 55% Dark Map) ───────── */}
      <div className="hidden md:flex flex-1 h-full overflow-hidden relative z-10">
        {/* ── 1. LEFT DIRECTORY CONTAINER (45%) ── */}
        <aside
          aria-label="Nearby Hospitals Directory"
          className="w-[45%] shrink-0 bg-zinc-950/40 backdrop-blur-md border-r border-white/10 flex flex-col h-full shadow-2xl relative z-10 overflow-hidden"
        >
          {/* Top Search & Filter Bar */}
          <div className="p-6 border-b border-white/10 space-y-4 shrink-0 bg-zinc-950/60 backdrop-blur-md">
            {/* Header Telemetry Indicator */}
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono font-bold text-rose-300 uppercase tracking-wider mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Verified Healthcare Directory</span>
                </div>
                <h1 className="text-xl font-light text-zinc-100 tracking-tight">
                  Nearby Hospitals
                </h1>
              </div>

              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-xl text-xs font-mono text-zinc-300 shadow-xs">
                <Activity className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                <span>Live Grid</span>
              </div>
            </div>

            {/* Dark Glass Search Field */}
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search hospitals, trauma centers, emergency care…"
              onClear={() => setSearchQuery('')}
              variant="dark"
            />

            {/* Dark Glass Segmented Category Filter Pills */}
            <FacilityFilterChips
              activeCategory={category}
              onSelectCategory={setCategory}
              emergencyOnly={emergencyOnly}
              onToggleEmergencyOnly={() => setEmergencyOnly((value) => !value)}
              variant="dark"
            />

            {/* Popular Search Terms */}
            {!searchQuery && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Popular:</span>
                {QUICK_TERMS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setSearchQuery(term)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08] border border-white/5 text-xs transition-all cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Directory Count Strip */}
          <div className="px-6 py-2.5 bg-zinc-950/80 border-b border-white/[0.08] flex items-center justify-between text-xs font-mono text-zinc-400 shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              <span>
                <strong className="text-zinc-100 font-semibold">{facilities.length}</strong>{' '}
                {activeQuery ? 'matching facilities' : 'facilities nearby'}
              </span>
            </div>
            <span className="text-zinc-500 text-[11px]">Jaipur Sector 1-12</span>
          </div>

          {/* Facilities List (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {selectedFacility && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <span>Selected Facility</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFacilityId(null)}
                    className="text-rose-400 hover:text-rose-300 font-normal lowercase tracking-normal cursor-pointer transition-colors"
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
              errorMessage={isError ? error.message : undefined}
              onRetry={() => void refetch()}
              activeQuery={activeQuery}
              onClearSearch={handleClear}
              onSelectQuerySuggestion={setSearchQuery}
            />
          </div>

          {/* Bottom Security / Clinical Disclaimer */}
          <div className="px-6 py-3 bg-zinc-950/80 border-t border-white/10 text-[11px] font-mono text-zinc-500 flex items-center gap-2.5 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
            <p className="truncate">
              ResQ coordinates navigation & care access. In life-threatening trauma, trigger SOS.
            </p>
          </div>
        </aside>

        {/* ── 2. RIGHT GOOGLE MAPS PANEL (55%) ── */}
        <section
          aria-label="Native Dark Obsidian Map View"
          className="w-[55%] flex-1 h-full min-w-0 p-4 lg:p-6 flex flex-col relative z-10 overflow-hidden"
        >
          {/* Map Viewport Container: Dark Glass Frame */}
          <div className="relative border border-white/10 rounded-2xl overflow-hidden shadow-2xl bg-zinc-950/90 w-full h-full">
            <MapView
              center={mapCenter}
              userLocation={hasLocation ? currentLocation : undefined}
              markers={mapMarkers}
              interactive
              options={{ styles: darkMapStyle }}
              styles={darkMapStyle}
              className="w-full h-full min-h-[400px]"
              onRecenter={refreshLocation}
            />

            {/* Floating Top Overlay Badges: Live Count Indicators on Map */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
              {/* Nearby Hospitals Live Badge */}
              <div className="bg-zinc-950/80 border border-white/10 backdrop-blur-md text-xs text-zinc-300 rounded-xl px-3.5 py-2 shadow-xl flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span className="font-semibold text-zinc-200">Hospitals</span>
                <span className="font-mono text-xs text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  {facilities.length}
                </span>
              </div>

              {/* 24/7 Emergency ERs Badge */}
              <div className="bg-zinc-950/80 border border-white/10 backdrop-blur-md text-xs text-zinc-300 rounded-xl px-3.5 py-2 shadow-xl flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 text-rose-500" />
                <span className="font-semibold text-zinc-200">24/7 ERs</span>
                <span className="font-mono text-xs text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  {facilities.filter((f) => f.emergencyAvailable).length}
                </span>
              </div>

              {/* Verified Facilities Badge */}
              <div className="hidden sm:flex items-center gap-2 bg-zinc-950/80 border border-white/10 backdrop-blur-md text-xs text-zinc-300 rounded-xl px-3.5 py-2 shadow-xl">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-semibold text-zinc-200">Verified</span>
                <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  {facilities.filter((f) => f.verified).length}
                </span>
              </div>
            </div>

            {/* Bottom Floating Telemetry Strip */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-zinc-950/80 border border-white/10 backdrop-blur-md p-1.5 rounded-xl shadow-xl">
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 border border-rose-500/30 rounded-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                Native Dark Obsidian Map
              </span>
              <span className="px-2 py-1 text-[11px] text-zinc-400 font-mono hidden sm:inline">
                Jaipur Healthcare Grid · 50km
              </span>
            </div>

            {/* Recenter Location Button */}
            <button
              type="button"
              onClick={refreshLocation}
              disabled={isUpdating}
              className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-200 shadow-xl transition-all cursor-pointer"
              title="Recenter live GPS coordinates"
            >
              <LocateFixed className="h-3.5 w-3.5 text-rose-400" />
              <span>Recenter</span>
            </button>

            {!hasLocation && (
              <div className="absolute left-4 top-16 z-30 rounded-xl border border-amber-500/30 bg-zinc-950/90 backdrop-blur-md px-3.5 py-2 text-xs text-amber-300 shadow-2xl flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>Location unavailable — using default Jaipur metropolitan grid coordinates.</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ─── Mobile View (< md) ────────────────────────────────────────────── */}
      <div className="md:hidden flex-1 relative overflow-hidden">
        {/* Mobile Top Floating Search & Filter Bar */}
        <div className="absolute inset-x-0 top-0 z-20 p-3 space-y-2 pointer-events-none">
          <div className="pointer-events-auto bg-zinc-950/90 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-2xl space-y-2.5">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
              placeholder="Search hospitals or emergency care…"
              variant="dark"
            />
            <FacilityFilterChips
              activeCategory={category}
              onSelectCategory={setCategory}
              emergencyOnly={emergencyOnly}
              onToggleEmergencyOnly={() => setEmergencyOnly((value) => !value)}
              variant="dark"
            />
          </div>
        </div>

        {/* Mobile Map / List Toggle Floating Pill */}
        <button
          type="button"
          onClick={() => setMobileView((value) => (value === 'map' ? 'list' : 'map'))}
          className="absolute right-4 top-28 z-30 inline-flex items-center gap-2 rounded-full bg-zinc-950/90 border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-100 shadow-2xl backdrop-blur-md transition-all cursor-pointer"
          aria-label={mobileView === 'map' ? 'Switch to list view' : 'Switch to map view'}
        >
          {mobileView === 'map' ? (
            <>
              <List className="w-3.5 h-3.5 text-rose-400" />
              <span>List ({facilities.length})</span>
            </>
          ) : (
            <>
              <MapIcon className="w-3.5 h-3.5 text-rose-400" />
              <span>Map View</span>
            </>
          )}
        </button>

        {mobileView === 'map' ? (
          <div className="absolute inset-0">
            <MapView
              center={mapCenter}
              userLocation={hasLocation ? currentLocation : undefined}
              markers={mapMarkers}
              interactive
              options={{ styles: darkMapStyle }}
              styles={darkMapStyle}
              className="w-full h-full min-h-[350px]"
              onRecenter={refreshLocation}
            />

            {selectedFacility && (
              <div className="absolute bottom-3 left-3 right-3 z-30">
                <FacilityPreview
                  facility={selectedFacility}
                  onClose={() => setSelectedFacilityId(null)}
                  isFloating
                />
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto bg-[#070709] px-4 pt-32 pb-6">
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
