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
} from 'lucide-react';
import type { UserLocation } from '../types/facility';
import type { NavigationMode } from '../types/route';
import { useFacility } from '../hooks/useFacility';
import { useGoogleRoute } from '../hooks/useGoogleRoute';
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

  const { currentLocation, location, permissionState, locationError, refreshLocation } = useOutletContext<LayoutContext>();
  const { facility, isLoading, isNotFound } = useFacility(facilityId);
  const { routes: availableRoutes, isLoading: isRouteLoading, isError: isRouteError, refetch: refetchRoute } = useGoogleRoute(facility, location);
  useEffect(() => {
    if (permissionState === 'prompt') refreshLocation();
  }, [permissionState, refreshLocation]);

  // Navigation State Machine
  const [navigationMode, setNavigationMode] = useState<NavigationMode>('preview');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-recommended');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState<boolean>(true);
  const isRouteUnavailable = isRouteError || (!isRouteLoading && Boolean(facility) && !location);

  const activeRoute = useMemo(() => {
    return availableRoutes.find((r) => r.id === selectedRouteId) || availableRoutes[0] || null;
  }, [availableRoutes, selectedRouteId]);

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
    const minToAdd = activeRoute?.durationSeconds ? Math.round(activeRoute.durationSeconds / 60) : 10;
    const arrivalDate = new Date(sessionStartTime + minToAdd * 60 * 1000);
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

  const handleSimulateArrival = () => {
    setNavigationMode('arrived');
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
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4 min-h-[60vh]">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">
          Calculating optimal route telemetry...
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
  if (isRouteUnavailable || isRouteLoading) {
    return (
      <div className="flex-1 max-w-md w-full mx-auto p-6 sm:p-12 text-center space-y-4 my-auto">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">Route Telemetry Unavailable</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {permissionState !== 'granted' ? 'Allow location access to calculate a real driving route.' : <>Unable to compute a real driving route to <strong className="text-slate-800">{facility.name}</strong> at this time.</>}
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2">
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
        </div>
      )}

      {/* ========================================================
          MAP VIEW ABSTRACTION (Decoupled Layer)
          ======================================================== */}
      <div className="relative w-full h-full flex-1">
        <MapView
          center={{ latitude: facility.latitude, longitude: facility.longitude }}
          userLocation={currentLocation}
          destination={{
            latitude: facility.latitude,
            longitude: facility.longitude,
            name: facility.name,
            address: facility.address,
            isEmergency: isEmergency || facility.emergencyAvailable,
          }}
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
            remainingTime={currentInstruction?.remainingTime || activeRoute?.duration || '10 min'}
            remainingDistance={currentInstruction?.remainingDistance || activeRoute?.distance || '2.4 km'}
            etaTime={etaClockTime}
            facilityName={facility.name}
            facilityPhone={facility.phone}
            currentStepIndex={currentStepIndex}
            totalSteps={activeRoute?.instructions.length || 6}
            onNextStep={handleNextStep}
            onRecenter={() => {}}
            onCallFacility={handleCallFacility}
            onEndNavigation={handleEndNavigation}
            onSimulateArrival={handleSimulateArrival}
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
