import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  AlertTriangle,
  RefreshCw,
  Phone,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import type { UserLocation } from '../types/facility';
import type { NavigationMode } from '../types/route';
import { useFacility } from '../hooks/useFacility';
import { useMapRoute } from '../hooks/useMapRoute';
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

export const RouteNavigationPage = () => {
  const { facilityId } = useParams<{ facilityId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmergency = searchParams.get('emergency') === 'true';

  const { currentLocation, location, permissionState, refreshLocation } = useOutletContext<LayoutContext>();
  const { facility, isLoading, isNotFound } = useFacility(facilityId);
  const { routes: availableRoutes, isLoading: isRouteLoading, isError: isRouteError, error: routeError, refetch: refetchRoute } = useMapRoute(facility, location ? currentLocation : null);
  useEffect(() => {
    if (permissionState === 'prompt') refreshLocation();
  }, [permissionState, refreshLocation]);

  // Navigation State Machine
  const [navigationMode, setNavigationMode] = useState<NavigationMode>('preview');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-recommended');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState<boolean>(true);
  const activeRoute = useMemo(() => {
    return availableRoutes.find((r) => r.id === selectedRouteId) || availableRoutes[0] || null;
  }, [availableRoutes, selectedRouteId]);

  const isRouteUnavailable = !isRouteLoading && (isRouteError || !activeRoute || (Boolean(facility) && !location));

  const externalDirectionsUrl = useMemo(() => {
    if (!facility) return '';
    if (typeof facility.latitude === 'number' && typeof facility.longitude === 'number' && Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude)) {
      return `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`;
    }
    const destQuery = [facility.name, facility.address].filter(Boolean).join(', ');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destQuery)}`;
  }, [facility]);

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

  // Compute calculated arrival clock time (e.g. 11 min from session start)
  const etaClockTime = useMemo(() => {
    if (!activeRoute?.durationSeconds) return null;
    const arrivalDate = new Date(sessionStartTime + Math.round(activeRoute.durationSeconds / 60) * 60 * 1000);
    return arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [activeRoute, sessionStartTime]);

  // Handlers
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

  const handleCallFacility = () => {
    if (facility) {
      window.location.href = `tel:${facility.phone.replace(/[^0-9+]/g, '')}`;
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

  // 1. Loading State
  if (isLoading || isRouteLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4 min-h-[60vh]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">
          Calculating Google Maps route...
        </p>
      </div>
    );
  }

  // 2. Facility Not Found State
  if (isNotFound || !facility) {
    return (
      <div className="flex-1 max-w-md w-full mx-auto p-6 sm:p-12 text-center space-y-4 my-auto">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">Destination Not Found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            The destination facility could not be found. Please return to the directory or search again.
          </p>
        </div>
        <div className="pt-2 flex justify-center gap-2">
          <Button variant="secondary" size="md" onClick={() => navigate('/search')}>
            Search Facilities
          </Button>
          <Button variant="primary" size="md" onClick={() => navigate('/')}>
            Home
          </Button>
        </div>
      </div>
    );
  }

  // 3. Route Unavailable Fallback State
  if (isRouteUnavailable) {
    return (
      <div className="flex-1 max-w-md w-full mx-auto p-6 sm:p-12 text-center space-y-4 my-auto">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">In-App Route Unavailable</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {permissionState !== 'granted'
              ? 'Enable location access to calculate a real driving route, or navigate directly in Google Maps.'
              : <>Unable to compute a driving route to <strong className="text-slate-800">{facility.name}</strong> right now. You can launch Google Maps directions directly.</>}
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-2">
          {externalDirectionsUrl && (
            <a
              href={externalDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Google Maps App
            </a>
          )}
          <div className="flex flex-col sm:flex-row justify-center gap-2">
            <Button
              variant="outline"
              size="md"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => { if (permissionState !== 'granted') refreshLocation(); else void refetchRoute(); }}
            >
              {permissionState !== 'granted' ? 'Try location again' : 'Retry Route'}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Phone className="w-4 h-4" />}
              onClick={handleCallFacility}
            >
              Call Facility Directly
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* ========================================================
          TOP NAVIGATION BAR (When not navigating)
          ======================================================== */}
      {navigationMode === 'preview' && (
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-40 flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-xl shadow-md hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">
              {isEmergency ? 'Emergency Flow' : 'Facility Details'}
            </span>
          </button>
          {externalDirectionsUrl && (
            <a
              href={externalDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200 text-blue-600 text-xs font-semibold px-3 py-2 rounded-xl shadow-md hover:bg-blue-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Maps</span>
            </a>
          )}
        </div>
      )}

      {/* ========================================================
          MAP VIEW ABSTRACTION (Decoupled Layer)
          ======================================================== */}
      <div className="relative w-full h-full flex-1">
        <MapView
          center={typeof facility.latitude === 'number' && typeof facility.longitude === 'number' ? { latitude: facility.latitude, longitude: facility.longitude } : undefined}
          userLocation={currentLocation}
          destination={typeof facility.latitude === 'number' && typeof facility.longitude === 'number' ? {
            latitude: facility.latitude,
            longitude: facility.longitude,
            name: facility.name,
            address: facility.address,
            isEmergency: isEmergency || facility.emergencyAvailable,
          } : undefined}
          activeRoute={activeRoute}
          alternativeRoutes={navigationMode === 'preview' ? alternativeRoutes : []}
          onSelectRoute={setSelectedRouteId}
          isNavigating={navigationMode === 'navigating'}
          currentStepIndex={currentStepIndex}
          interactive={true}
          className="w-full h-full"
        />
      </div>

      {/* ========================================================
          ACTIVE NAVIGATION MODE: TOP TURN INSTRUCTION BANNER
          ======================================================== */}
      {navigationMode === 'navigating' && currentInstruction && (
        <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:w-[440px] z-40 pointer-events-auto">
          <NavigationInstruction
            currentInstruction={currentInstruction}
            nextInstruction={nextInstruction}
            destinationName={facility.name}
            isEmergency={isEmergency}
          />
        </div>
      )}

      {/* ========================================================
          ACTIVE NAVIGATION MODE: BOTTOM CONTROLS BAR
          ======================================================== */}
      {navigationMode === 'navigating' && (
        <div className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:w-[440px] z-40 pointer-events-auto">
          <NavigationControls
            remainingTime={currentInstruction?.remainingTime || activeRoute?.duration || 'Unavailable'}
            remainingDistance={currentInstruction?.remainingDistance || activeRoute?.distance || 'Unavailable'}
            etaTime={etaClockTime ?? 'Unavailable'}
            facilityName={facility.name}
            facilityPhone={facility.phone}
            currentStepIndex={currentStepIndex}
            totalSteps={activeRoute?.instructions.length || 6}
            onNextStep={handleNextStep}
            onRecenter={() => {}}
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
        <div className="hidden md:flex absolute top-4 left-4 bottom-4 w-[420px] z-30 flex-col bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden pointer-events-auto">
          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Top Back Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Route Preview
              </span>
            </div>

            {/* Destination & Telemetry Summary Card */}
            {activeRoute && (
              <RouteSummary
                facility={facility}
                selectedRoute={activeRoute}
                isEmergency={isEmergency}
                currentLocationName={currentLocation.label}
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
          {/* Pull Toggle Handle */}
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
            {/* Route Summary */}
            {activeRoute && (
              <RouteSummary
                facility={facility}
                selectedRoute={activeRoute}
                isEmergency={isEmergency}
                currentLocationName={currentLocation.label}
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
          {!isMobilePanelExpanded && activeRoute && (
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900 text-sm truncate max-w-[180px]">
                  {facility.name}
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
          ARRIVAL STATE MODAL / OVERLAY
          ======================================================== */}
      {navigationMode === 'arrived' && (
        <div className="absolute inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <ArrivalState
            facility={facility}
            isEmergency={isEmergency}
            onViewFacility={() => navigate(`/facility/${facility.id}`)}
            onEndTrip={() => navigate('/')}
          />
        </div>
      )}
    </div>
  );
};
