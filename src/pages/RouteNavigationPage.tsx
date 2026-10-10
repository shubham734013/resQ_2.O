import { useState, useMemo, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  AlertTriangle,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search,
  MapPin,
  Compass,
  ArrowUpDown,
  X,
  Flame,
  CheckCircle2,
  LocateFixed,
} from 'lucide-react';
import type { Facility, UserLocation } from '../types/facility';
import type { NavigationMode } from '../types/route';
import { useFacility } from '../hooks/useFacility';
import { useFacilities } from '../hooks/useFacilities';
import { useNearbyFacilities } from '../hooks/useNearbyFacilities';
import { useMapRoute } from '../hooks/useMapRoute';
import { mapsApi } from '../services/mapsApi';
import { MapView } from '../components/map/MapView';
import { RouteOption } from '../components/route/RouteOption';
import { RouteSummary } from '../components/route/RouteSummary';
import { NavigationInstruction } from '../components/route/NavigationInstruction';
import { NavigationControls } from '../components/route/NavigationControls';
import { ArrivalState } from '../components/route/ArrivalState';
import { Button } from '../components/common/Button';

interface LayoutContext {
  currentLocation: UserLocation;
  location: { latitude: number; longitude: number; accuracyMeters?: number; timestamp: number } | null;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported' | 'unknown';
  locationError: string | null;
  refreshLocation: () => void;
  isUpdating: boolean;
}

interface SelectedDestination {
  id?: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  latitude: number;
  longitude: number;
  emergencyAvailable?: boolean;
}

export const RouteNavigationPage = () => {
  const { facilityId } = useParams<{ facilityId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmergency = searchParams.get('emergency') === 'true';

  const { currentLocation, location, permissionState, refreshLocation } = useOutletContext<LayoutContext>();
  const { facility } = useFacility(facilityId);

  // Direction Search & Overrides
  const [customDestination, setCustomDestination] = useState<SelectedDestination | null>(null);
  const [customOrigin, setCustomOrigin] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const [isEditingOrigin, setIsEditingOrigin] = useState(false);
  const [originInput, setOriginInput] = useState('');
  const [isGeocodingOrigin, setIsGeocodingOrigin] = useState(false);
  const [originGeocodeError, setOriginGeocodeError] = useState<string | null>(null);

  // Direction Search Modal / Drawer
  const [isSearchOpen, setIsSearchOpen] = useState(!facilityId);
  const [destinationSearchText, setDestinationSearchText] = useState('');
  const [placesSearchResults, setPlacesSearchResults] = useState<Array<{ id: string; name: string; address?: string; latitude: number; longitude: number }>>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);

  // Nearby facilities for quick direction destinations
  const hasRealOrigin = Boolean(
    customOrigin || (location && Number.isFinite(location.latitude) && (location.latitude !== 0 || location.longitude !== 0))
  );
  const originCoords = customOrigin ?? (location ? { latitude: location.latitude, longitude: location.longitude } : null);
  const nearbyFacilities = useNearbyFacilities(originCoords?.latitude ?? null, originCoords?.longitude ?? null);

  // Facilities list for auto-matching destination search query
  const { facilities: matchingFacilities } = useFacilities({
    searchQuery: destinationSearchText,
  });

  // Effective destination
  const effectiveDestination = useMemo<SelectedDestination | null>(() => {
    if (customDestination) return customDestination;
    if (facility && typeof facility.latitude === 'number' && typeof facility.longitude === 'number') {
      return {
        id: facility.id,
        name: facility.name,
        address: facility.address,
        phone: facility.phone,
        latitude: facility.latitude,
        longitude: facility.longitude,
        emergencyAvailable: facility.emergencyAvailable,
      };
    }
    return null;
  }, [customDestination, facility]);

  // Route calculation
  const routeOptions = useMemo(() => ({
    customOrigin: customOrigin ? { latitude: customOrigin.latitude, longitude: customOrigin.longitude } : null,
    customDestination: effectiveDestination ? { latitude: effectiveDestination.latitude, longitude: effectiveDestination.longitude, name: effectiveDestination.name, address: effectiveDestination.address } : null,
  }), [customOrigin, effectiveDestination]);

  const {
    routes: availableRoutes,
    isLoading: isRouteLoading,
    isFallback,
    refetch: refetchRoute,
  } = useMapRoute(facility ?? null, location ? currentLocation : null, routeOptions);

  useEffect(() => {
    if (permissionState === 'prompt') refreshLocation();
  }, [permissionState, refreshLocation]);

  // Navigation State Machine
  const [navigationMode, setNavigationMode] = useState<NavigationMode>('preview');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-recommended');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState<boolean>(true);
  const [recenterCounter, setRecenterCounter] = useState<number>(0);

  const activeRoute = useMemo(() => {
    return availableRoutes.find((r) => r.id === selectedRouteId) || availableRoutes[0] || null;
  }, [availableRoutes, selectedRouteId]);

  // External Google Maps directions URL
  const externalDirectionsUrl = useMemo(() => {
    if (!effectiveDestination) return '';
    const dest = `${effectiveDestination.latitude},${effectiveDestination.longitude}`;
    const orig = originCoords ? `&origin=${originCoords.latitude},${originCoords.longitude}` : '';
    return `https://www.google.com/maps/dir/?api=1${orig}&destination=${dest}&travelmode=driving`;
  }, [effectiveDestination, originCoords]);

  const alternativeRoutes = useMemo(() => {
    return availableRoutes.filter((r) => r.id !== activeRoute?.id);
  }, [availableRoutes, activeRoute]);

  const currentInstruction = useMemo(() => {
    if (!activeRoute || !activeRoute.instructions.length) return null;
    return activeRoute.instructions[currentStepIndex] || activeRoute.instructions[0];
  }, [activeRoute, currentStepIndex]);

  const nextInstruction = useMemo(() => {
    if (!activeRoute) return undefined;
    return activeRoute.instructions[currentStepIndex + 1];
  }, [activeRoute, currentStepIndex]);

  const [sessionStartTime] = useState(() => Date.now());

  const etaClockTime = useMemo(() => {
    if (!activeRoute?.durationSeconds) return null;
    const arrivalDate = new Date(sessionStartTime + Math.round(activeRoute.durationSeconds / 60) * 60 * 1000);
    return arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [activeRoute, sessionStartTime]);

  // Handle Search for Google Places
  const searchPlaces = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPlacesSearchResults([]);
      return;
    }
    setIsSearchingPlaces(true);
    try {
      const places = await mapsApi.placeSearch(trimmed);
      const mapped = places.flatMap((p) => {
        if (!p.location?.latitude || !p.location?.longitude) return [];
        return [{
          id: p.id,
          name: p.displayName,
          address: p.formattedAddress,
          latitude: p.location.latitude,
          longitude: p.location.longitude,
        }];
      });
      setPlacesSearchResults(mapped);
    } catch {
      setPlacesSearchResults([]);
    } finally {
      setIsSearchingPlaces(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (destinationSearchText.trim().length >= 2) {
        void searchPlaces(destinationSearchText);
      } else {
        setPlacesSearchResults([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [destinationSearchText, searchPlaces]);

  // Geocode custom origin address
  const handleApplyOriginAddress = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const query = originInput.trim();
    if (!query) return;
    setIsGeocodingOrigin(true);
    setOriginGeocodeError(null);
    try {
      const geocoded = await mapsApi.geocode(query);
      setCustomOrigin({
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        label: geocoded.formattedAddress,
      });
      setIsEditingOrigin(false);
      setOriginInput('');
    } catch (err) {
      setOriginGeocodeError(err instanceof Error ? err.message : 'Could not locate that address.');
    } finally {
      setIsGeocodingOrigin(false);
    }
  };

  const handleUseGpsOrigin = () => {
    setCustomOrigin(null);
    setIsEditingOrigin(false);
    refreshLocation();
  };

  const handleSelectFacilityDestination = (fac: Facility) => {
    setCustomDestination(null);
    setIsSearchOpen(false);
    navigate(`/route/${fac.id}${isEmergency ? '?emergency=true' : ''}`);
  };

  const handleSelectCustomDestination = (dest: { id: string; name: string; address?: string; latitude: number; longitude: number }) => {
    setCustomDestination({
      id: dest.id,
      name: dest.name,
      address: dest.address,
      latitude: dest.latitude,
      longitude: dest.longitude,
      emergencyAvailable: false,
    });
    setIsSearchOpen(false);
  };

  const handleSwapOriginDestination = () => {
    if (!effectiveDestination || !originCoords) return;
    const oldDest = { ...effectiveDestination };
    const oldOriginLabel = customOrigin?.label ?? currentLocation.label;

    setCustomDestination({
      name: oldOriginLabel,
      address: oldOriginLabel,
      latitude: originCoords.latitude,
      longitude: originCoords.longitude,
    });
    setCustomOrigin({
      latitude: oldDest.latitude,
      longitude: oldDest.longitude,
      label: oldDest.name,
    });
  };

  // Handlers for Navigation Steps
  const handleStartNavigation = () => {
    setCurrentStepIndex(0);
    setNavigationMode('navigating');
  };

  const handleEndNavigation = () => {
    setNavigationMode('preview');
    setCurrentStepIndex(0);
  };

  const handleNextStep = () => {
    if (!activeRoute) return;
    if (currentStepIndex + 1 >= activeRoute.instructions.length) {
      setNavigationMode('arrived');
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleRecenter = () => {
    setRecenterCounter((prev) => prev + 1);
  };

  const handleCallFacility = () => {
    const phone = effectiveDestination?.phone || facility?.phone;
    if (phone) {
      window.location.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
    }
  };

  const handleBack = () => {
    if (navigationMode === 'navigating') {
      handleEndNavigation();
    } else if (isEmergency) {
      navigate('/sos');
    } else if (facility) {
      navigate(`/facility/${facility.id}`);
    } else {
      navigate('/search');
    }
  };

  // Prepare a synthesized Facility model for RouteSummary
  const displayFacility: Facility | null = useMemo(() => {
    if (facility) return facility;
    if (effectiveDestination) {
      return {
        id: effectiveDestination.id ?? 'custom-destination',
        name: effectiveDestination.name,
        type: 'Hospital',
        category: 'general',
        address: effectiveDestination.address ?? 'Address verified',
        phone: effectiveDestination.phone ?? '',
        openStatus: 'Destination Verified',
        isOpen: true,
        emergencyAvailable: Boolean(effectiveDestination.emergencyAvailable),
        latitude: effectiveDestination.latitude,
        longitude: effectiveDestination.longitude,
        distance: activeRoute?.distance ?? '',
        estimatedTime: activeRoute?.duration ?? '',
        verified: true,
        capabilities: [],
        lastUpdated: 'Live Navigation',
      };
    }
    return null;
  }, [facility, effectiveDestination, activeRoute]);

  const activeOriginLabel = customOrigin?.label ?? currentLocation.label ?? 'Current Location';

  return (
    <div className="relative flex-1 flex flex-col h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* ========================================================
          TOP DIRECTION CONTROLS BAR (When in preview mode)
          ======================================================== */}
      {navigationMode === 'preview' && (
        <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-auto sm:max-w-xl z-40 flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-xl shadow-md hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">
              {isEmergency ? 'Emergency Flow' : 'Back'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200 text-slate-900 text-xs font-medium px-3.5 py-2 rounded-xl shadow-md hover:bg-slate-50 transition-colors cursor-pointer min-w-0"
          >
            <Search className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[200px] font-semibold">
              {effectiveDestination?.name ?? 'Search Destination'}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Change</span>
          </button>

          {effectiveDestination && originCoords && (
            <button
              type="button"
              onClick={handleSwapOriginDestination}
              title="Swap origin and destination"
              aria-label="Swap origin and destination"
              className="p-2 bg-white/95 backdrop-blur-md border border-slate-200 text-slate-600 rounded-xl shadow-md hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          )}

          {externalDirectionsUrl && (
            <a
              href={externalDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200 text-blue-600 text-xs font-semibold px-3 py-2 rounded-xl shadow-md hover:bg-blue-50 transition-colors ml-auto sm:ml-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Maps App</span>
            </a>
          )}
        </div>
      )}

      {/* ========================================================
          FULL MAP VIEW LAYER
          ======================================================== */}
      <div className="relative w-full h-full flex-1">
        <MapView
          center={effectiveDestination ? { latitude: effectiveDestination.latitude, longitude: effectiveDestination.longitude } : originCoords ? { latitude: originCoords.latitude, longitude: originCoords.longitude } : undefined}
          userLocation={customOrigin ? { latitude: customOrigin.latitude, longitude: customOrigin.longitude, label: customOrigin.label, accuracy: 'high' } : currentLocation}
          destination={effectiveDestination ? {
            latitude: effectiveDestination.latitude,
            longitude: effectiveDestination.longitude,
            name: effectiveDestination.name,
            address: effectiveDestination.address,
            isEmergency: isEmergency || Boolean(effectiveDestination.emergencyAvailable),
          } : undefined}
          activeRoute={activeRoute}
          alternativeRoutes={navigationMode === 'preview' ? alternativeRoutes : []}
          onSelectRoute={setSelectedRouteId}
          isNavigating={navigationMode === 'navigating'}
          currentStepIndex={currentStepIndex}
          interactive={true}
          onRecenter={handleRecenter}
          recenterTrigger={recenterCounter}
          className="w-full h-full"
        />
      </div>

      {/* Route Calculation Floating Spinner */}
      {isRouteLoading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-800">Calculating driving route...</span>
        </div>
      )}

      {/* ========================================================
          ACTIVE NAVIGATION MODE: TOP TURN INSTRUCTION BANNER
          ======================================================== */}
      {navigationMode === 'navigating' && currentInstruction && effectiveDestination && (
        <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:w-[440px] z-40 pointer-events-auto">
          <NavigationInstruction
            currentInstruction={currentInstruction}
            nextInstruction={nextInstruction}
            destinationName={effectiveDestination.name}
            isEmergency={isEmergency}
          />
        </div>
      )}

      {/* ========================================================
          ACTIVE NAVIGATION MODE: BOTTOM CONTROLS BAR
          ======================================================== */}
      {navigationMode === 'navigating' && effectiveDestination && (
        <div className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:w-[440px] z-40 pointer-events-auto">
          <NavigationControls
            remainingTime={currentInstruction?.remainingTime || activeRoute?.duration || 'Calculating'}
            remainingDistance={currentInstruction?.remainingDistance || activeRoute?.distance || 'Calculating'}
            etaTime={etaClockTime ?? 'Calculating'}
            facilityName={effectiveDestination.name}
            facilityPhone={effectiveDestination.phone || facility?.phone || ''}
            currentStepIndex={currentStepIndex}
            totalSteps={activeRoute?.instructions.length || 1}
            onNextStep={handleNextStep}
            onRecenter={handleRecenter}
            onCallFacility={handleCallFacility}
            onEndNavigation={handleEndNavigation}
            isEmergency={isEmergency}
          />
        </div>
      )}

      {/* ========================================================
          ROUTE PREVIEW MODE: DESKTOP & TABLET TWO-PANE SIDEBAR
          ======================================================== */}
      {navigationMode === 'preview' && (
        <div className="hidden md:flex absolute top-16 left-4 bottom-4 w-[420px] z-30 flex-col bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden pointer-events-auto">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Direct Road Path Fallback Banner */}
            {isFallback && activeRoute && (
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Direct Route Estimate</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Route estimated along direct arterial paths. For live turn-by-turn traffic navigation, open in Google Maps.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  {externalDirectionsUrl && (
                    <a
                      href={externalDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 underline"
                    >
                      Open in Google Maps App <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void refetchRoute()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950 ml-auto cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Route
                  </button>
                </div>
              </div>
            )}

            {/* GPS Location Prompt if location missing */}
            {!hasRealOrigin && (
              <div className="p-4 bg-blue-50/90 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-3">
                <div className="flex items-start gap-2">
                  <Compass className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-blue-900 block">Starting location required</span>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Enable GPS access or enter an address to calculate driving directions.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<LocateFixed className="w-3.5 h-3.5" />}
                    onClick={refreshLocation}
                  >
                    Enable GPS Location
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<MapPin className="w-3.5 h-3.5" />}
                    onClick={() => setIsEditingOrigin(true)}
                  >
                    Enter Starting Address
                  </Button>
                </div>
              </div>
            )}

            {/* Origin Address Editor Drawer/Block */}
            {isEditingOrigin && (
              <form onSubmit={handleApplyOriginAddress} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Set Starting Location</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingOrigin(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={originInput}
                    onChange={(e) => setOriginInput(e.target.value)}
                    placeholder="Enter starting address (e.g. MI Road, Jaipur)..."
                    className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!originInput.trim() || isGeocodingOrigin}
                  >
                    {isGeocodingOrigin ? 'Locating...' : 'Set'}
                  </Button>
                </div>
                {originGeocodeError && (
                  <p className="text-[11px] text-rose-600 font-medium">{originGeocodeError}</p>
                )}
                {customOrigin && (
                  <button
                    type="button"
                    onClick={handleUseGpsOrigin}
                    className="text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    Switch back to GPS location
                  </button>
                )}
              </form>
            )}

            {/* Origin & Destination Direction Summary Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Origin</span>
                    <p className="font-semibold text-slate-800 truncate">{activeOriginLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingOrigin(true)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 shrink-0"
                >
                  Change
                </button>
              </div>

              <div className="border-l-2 border-dashed border-slate-200 ml-1 h-2" />

              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-600 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Destination</span>
                    <p className="font-bold text-slate-900 truncate">
                      {effectiveDestination?.name ?? 'No destination selected'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 shrink-0"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Destination & Telemetry Summary Card */}
            {displayFacility && activeRoute && (
              <RouteSummary
                facility={displayFacility}
                selectedRoute={activeRoute}
                isEmergency={isEmergency}
                currentLocationName={activeOriginLabel}
                onStartNavigation={handleStartNavigation}
                onCallFacility={handleCallFacility}
              />
            )}

            {/* Route Options Selection List */}
            {availableRoutes.length > 1 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Route Options
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {availableRoutes.length} options available
                  </span>
                </div>

                <div className="space-y-2" role="radiogroup" aria-label="Route options">
                  {availableRoutes.map((route) => (
                    <RouteOption
                      key={route.id}
                      route={route}
                      isSelected={selectedRouteId === route.id}
                      onSelect={() => setSelectedRouteId(route.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          ROUTE PREVIEW MODE: MOBILE BOTTOM SHEET / FLOATING PANEL
          ======================================================== */}
      {navigationMode === 'preview' && (
        <div className="md:hidden absolute bottom-0 inset-x-0 z-30 pointer-events-auto bg-white/95 backdrop-blur-md border-t border-slate-200/90 rounded-t-2xl shadow-2xl transition-all duration-300">
          <div
            className="flex items-center justify-between px-4 py-2 border-b border-slate-100 cursor-pointer"
            onClick={() => setIsMobilePanelExpanded((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <span className="w-8 h-1 rounded-full bg-slate-300 mx-auto" />
            </div>
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <span>{isMobilePanelExpanded ? 'Collapse' : 'Expand Route Details'}</span>
              {isMobilePanelExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </div>
          </div>

          <div
            className={`p-4 space-y-4 max-h-[72vh] overflow-y-auto ${
              isMobilePanelExpanded ? 'block' : 'hidden'
            }`}
          >
            {/* Fallback Road Notice */}
            {isFallback && activeRoute && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <p className="font-semibold">Direct Route Estimate</p>
                <p className="text-[11px] text-amber-800">
                  Estimated road distance and time. Tap Google Maps App for live turn navigation.
                </p>
              </div>
            )}

            {!hasRealOrigin && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-2">
                <p className="font-bold text-blue-900">Location required for driving directions</p>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={refreshLocation}>
                    Enable GPS
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsEditingOrigin(true)}>
                    Enter Address
                  </Button>
                </div>
              </div>
            )}

            {/* Route Summary */}
            {displayFacility && activeRoute && (
              <RouteSummary
                facility={displayFacility}
                selectedRoute={activeRoute}
                isEmergency={isEmergency}
                currentLocationName={activeOriginLabel}
                onStartNavigation={handleStartNavigation}
                onCallFacility={handleCallFacility}
              />
            )}

            {/* Route Options Chips */}
            {availableRoutes.length > 1 && (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Select Route
                </span>
                <div className="space-y-2" role="radiogroup" aria-label="Route options">
                  {availableRoutes.map((route) => (
                    <RouteOption
                      key={route.id}
                      route={route}
                      isSelected={selectedRouteId === route.id}
                      onSelect={() => setSelectedRouteId(route.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Collapsed State Bar */}
          {!isMobilePanelExpanded && effectiveDestination && activeRoute && (
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900 text-sm truncate max-w-[180px]">
                  {effectiveDestination.name}
                </p>
                <p className="text-xs text-slate-500">
                  {activeRoute.duration} &bull; {activeRoute.distance}
                </p>
              </div>
              <Button
                variant={isEmergency ? 'emergency' : 'primary'}
                size="md"
                onClick={handleStartNavigation}
                className="font-bold"
              >
                Start
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          DIRECTION SEARCH MODAL / DRAWER
          ======================================================== */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 pointer-events-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Direction Search</h3>
                <p className="text-xs text-slate-500">Find healthcare facilities and destination places</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={destinationSearchText}
                  onChange={(e) => setDestinationSearchText(e.target.value)}
                  placeholder="Search hospitals, trauma centers, clinics, places..."
                  autoFocus
                  className="w-full h-11 pl-10 pr-10 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
                {destinationSearchText && (
                  <button
                    type="button"
                    onClick={() => setDestinationSearchText('')}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Places / External results */}
              {placesSearchResults.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Google Places Results
                  </span>
                  <div className="space-y-1.5">
                    {placesSearchResults.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => handleSelectCustomDestination(place)}
                        className="w-full p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 text-left transition flex items-start gap-3 cursor-pointer"
                      >
                        <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{place.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{place.address}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified Facilities Search Results */}
              {matchingFacilities.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    {destinationSearchText ? 'Matching Facilities' : 'Verified Facilities'}
                  </span>
                  <div className="space-y-1.5">
                    {matchingFacilities.slice(0, 6).map((fac) => (
                      <button
                        key={fac.id}
                        type="button"
                        onClick={() => handleSelectFacilityDestination(fac)}
                        className="w-full p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 text-left transition flex items-start justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{fac.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{fac.address}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {fac.emergencyAvailable && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded">
                                  <Flame className="w-2.5 h-2.5" /> Emergency
                                </span>
                              )}
                              {fac.verified && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {fac.distance && (
                          <span className="text-xs font-semibold text-slate-600 shrink-0 self-center">
                            {fac.distance}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nearby Facilities Recommendations when query is short */}
              {!destinationSearchText && (nearbyFacilities.data?.items?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Nearby Emergency Facilities
                  </span>
                  <div className="space-y-1.5">
                    {nearbyFacilities.data?.items.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectFacilityDestination({
                          id: item.id,
                          name: item.name,
                          type: item.type ?? 'Hospital',
                          category: 'emergency',
                          address: item.address ?? item.city ?? '',
                          phone: item.phone ?? '',
                          openStatus: 'Nearby Emergency',
                          isOpen: true,
                          emergencyAvailable: item.emergencyAvailability === 'AVAILABLE',
                          latitude: item.latitude,
                          longitude: item.longitude,
                          distance: `${(item.distanceMeters / 1000).toFixed(1)} km`,
                          estimatedTime: '',
                          verified: item.verificationStatus === 'VERIFIED',
                          capabilities: item.capabilities,
                          lastUpdated: 'Live',
                        })}
                        className="w-full p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 text-left transition flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{item.address || item.city}</p>
                        </div>
                        <span className="text-xs font-bold text-blue-600 shrink-0">
                          {(item.distanceMeters / 1000).toFixed(1)} km
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Searching loader */}
              {isSearchingPlaces && (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Searching Google Places...</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setIsSearchOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ARRIVAL STATE MODAL / OVERLAY
          ======================================================== */}
      {navigationMode === 'arrived' && displayFacility && (
        <div className="absolute inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <ArrivalState
            facility={displayFacility}
            isEmergency={isEmergency}
            onViewFacility={() => navigate(`/facility/${displayFacility.id}`)}
            onEndTrip={() => navigate('/')}
          />
        </div>
      )}
    </div>
  );
};
