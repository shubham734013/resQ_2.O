import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Clock, MapPin, Phone, RefreshCw, ShieldCheck } from 'lucide-react';
import type { Facility, UserLocation } from '../types/facility';
import type { EmergencyFlowStep, EmergencyRequestView, EmergencySituationId, FacilityRecommendationItem } from '../types/emergency';
import { EMERGENCY_SITUATIONS, getRecommendedFacilities } from '../data/emergencySituations';
import { emergencyApi, type EmergencyDiscoveryHospital } from '../services/emergencyApi';
import { facilityApi } from '../services/facilityApi';
import { EmergencyMode } from '../components/emergency/EmergencyMode';
import { SituationSelector } from '../components/emergency/SituationSelector';
import { LocationConfirmation } from '../components/emergency/LocationConfirmation';
import { EmergencySearchState } from '../components/emergency/EmergencySearchState';
import { FacilityRecommendation } from '../components/emergency/FacilityRecommendation';
import { CoordinationStatus } from '../components/emergency/CoordinationStatus';
import { Button } from '../components/common/Button';
import { MapView } from '../components/map/MapView';

interface LayoutContext {
  currentLocation: UserLocation;
  refreshLocation: () => void;
  isUpdating: boolean;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported' | 'unknown';
  locationError?: string | null;
}

const ACTIVE_STATUSES: EmergencyRequestView['status'][] = ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'];
const activeEmergencyQueryKey = ['emergency-requests', 'active'] as const;
const formatDistance = (meters: number) => meters >= 1000 ? (meters / 1000).toFixed(1) + ' km' : Math.round(meters) + ' m';
const relativeUpdated = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + ' min ago';
  return Math.round(minutes / 60) + ' hr ago';
};
const toFacility = (item: EmergencyDiscoveryHospital): Facility => ({
  id: item.id,
  name: item.name,
  type: item.type,
  category: (() => {
    const text = [item.type, ...item.services, ...item.capabilities].join(' ').toLowerCase();
    if (text.includes('trauma')) return 'trauma';
    if (text.includes('cardio') || text.includes('heart')) return 'cardiology';
    if (text.includes('neuro') || text.includes('stroke')) return 'neurology';
    if (text.includes('pediatric') || text.includes('paediatric')) return 'pediatric';
    if (text.includes('urgent')) return 'urgent_care';
    return 'emergency';
  })(),
  distance: formatDistance(item.distanceMeters),
  distanceMeters: item.distanceMeters,
  distanceType: item.distanceType,
  estimatedTime: item.estimatedTime ?? 'Driving ETA unavailable',
  emergencyAvailable: item.emergencyAvailability === 'AVAILABLE',
  verified: item.verified,
  lastUpdated: relativeUpdated(item.lastUpdated),
  latitude: item.latitude,
  longitude: item.longitude,
  address: [item.address, item.city, item.state, item.country].filter(Boolean).join(', '),
  phone: item.phone,
  openStatus: item.emergencyAvailability === 'LIMITED' ? 'Emergency intake reported as limited' : 'Emergency intake reported as available',
  isOpen: true,
  isAvailable: true,
  capabilities: [...item.services, ...item.capabilities],
});
const situationIdForLabel = (label: string): EmergencySituationId =>
  EMERGENCY_SITUATIONS.find((situation) => situation.label === label)?.id ?? 'other';
const fallbackFacility = (hospitalId: string): Facility => ({
  id: hospitalId, name: 'Selected hospital', type: 'Hospital', category: 'emergency', distance: 'Unavailable',
  estimatedTime: 'Driving ETA unavailable', emergencyAvailable: false, verified: false, lastUpdated: 'unknown',
  address: 'Hospital details are temporarily unavailable', phone: '', openStatus: 'Request already exists',
  isOpen: false, isAvailable: false, capabilities: [],
});
const loadActiveEmergency = async (): Promise<EmergencyRequestView | null> => {
  const response = await emergencyApi.list({ limit: 50 });
  return response.items.find((item) => ACTIVE_STATUSES.includes(item.status)) ?? null;
};

export const EmergencyPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const outletContext = useOutletContext<LayoutContext | undefined>();
  const [fallbackLocation, setFallbackLocation] = useState<UserLocation>({ latitude: 0, longitude: 0, label: 'Location unavailable', accuracy: 'approximate' });
  const [fallbackPermission, setFallbackPermission] = useState<LayoutContext['permissionState']>('prompt');
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const refreshFallbackLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setFallbackPermission('unsupported');
      setFallbackError('This browser does not support location services. Enter an address to continue.');
      return;
    }
    setFallbackError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFallbackLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Current GPS location',
          accuracy: position.coords.accuracy <= 50 ? 'high' : 'approximate',
          accuracyMeters: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setFallbackPermission('granted');
        setFallbackError(null);
      },
      (error) => {
        setFallbackPermission(error.code === error.PERMISSION_DENIED ? 'denied' : 'unknown');
        setFallbackError(error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. You can retry permission or enter an address manually.'
          : 'GPS is unavailable right now. Retry or enter an address manually.');
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  }, []);
  const currentLocation = outletContext?.currentLocation ?? fallbackLocation;
  const refreshLocation = outletContext?.refreshLocation ?? refreshFallbackLocation;
  const permissionState = outletContext?.permissionState ?? fallbackPermission;
  const locationError = outletContext?.locationError ?? fallbackError;
  const valid = Number.isFinite(currentLocation.latitude) && currentLocation.latitude >= -90 && currentLocation.latitude <= 90 &&
    Number.isFinite(currentLocation.longitude) && currentLocation.longitude >= -180 && currentLocation.longitude <= 180 &&
    currentLocation.label !== 'Location unavailable';
  const preselectedId = searchParams.get('facility');

  const [currentStep, setCurrentStep] = useState<EmergencyFlowStep>('situation');
  const [selectedSituationId, setSelectedSituationId] = useState<EmergencySituationId | null>(null);
  const [confirmedLocation, setConfirmedLocation] = useState<UserLocation | null>(null);
  const [recommendations, setRecommendations] = useState<FacilityRecommendationItem[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [emergencyRequestId, setEmergencyRequestId] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(30000);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [coordinationError, setCoordinationError] = useState<string | null>(null);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const activeRequestQuery = useQuery({
    queryKey: activeEmergencyQueryKey,
    queryFn: loadActiveEmergency,
    staleTime: 15000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!valid && permissionState === 'prompt') refreshLocation();
  }, [valid, permissionState, refreshLocation]);

  // Recover a persistent active request after refresh/navigation before allowing a second SOS.
  useEffect(() => {
    const active = activeRequestQuery.data;
    if (!active || emergencyRequestId || isCreatingRequest) return;
    let cancelled = false;
    void (async () => {
      let facility = fallbackFacility(active.hospitalId);
      try {
        facility = await facilityApi.getById(active.hospitalId);
      } catch {
        // Keep the persistent request visible even if the hospital profile was subsequently hidden.
      }
      if (cancelled) return;
      setEmergencyRequestId(active.id);
      setSelectedFacility({
        ...facility,
        distance: typeof active.routeDistanceMeters === 'number' ? formatDistance(active.routeDistanceMeters) : facility.distance || 'Unavailable',
        distanceMeters: active.routeDistanceMeters ?? facility.distanceMeters,
        distanceType: typeof active.routeDistanceMeters === 'number' ? 'DRIVING' : facility.distanceType,
        estimatedTime: typeof active.etaMinutes === 'number' ? active.etaMinutes + ' min' : 'Driving ETA unavailable',
      });
      setSelectedSituationId(active.category ?? situationIdForLabel(active.situationType));
      if (typeof active.latitude === 'number' && typeof active.longitude === 'number') {
        setConfirmedLocation({
          latitude: active.latitude, longitude: active.longitude, label: active.location || 'Previously confirmed location',
          accuracy: 'approximate', timestamp: new Date(active.reportedAt).getTime(),
        });
      }
      setCurrentStep('coordination');
    })();
    return () => { cancelled = true; };
  }, [activeRequestQuery.data, emergencyRequestId, isCreatingRequest]);

  useEffect(() => {
    if (!preselectedId || !valid || selectedFacility) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await emergencyApi.discover(currentLocation.latitude, currentLocation.longitude, selectedSituationId ?? 'other', 50000);
        const found = data.items.find((item) => item.id === preselectedId);
        if (found && !cancelled) setSelectedFacility(toFacility(found));
      } catch {
        // The user can continue through the normal discovery path if a deep link is stale.
      }
    })();
    return () => { cancelled = true; };
  }, [preselectedId, valid, currentLocation.latitude, currentLocation.longitude, selectedFacility, selectedSituationId]);

  const selectedSituation = useMemo(
    () => EMERGENCY_SITUATIONS.find((situation) => situation.id === selectedSituationId),
    [selectedSituationId],
  );
  const flowLocation = confirmedLocation ?? currentLocation;
  const locationUnavailable = permissionState === 'denied' || permissionState === 'unsupported' || (!valid && Boolean(locationError));

  const handleLocationConfirm = async (location: UserLocation) => {
    if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90 ||
        !Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180 ||
        !selectedSituationId) {
      setSearchError('Choose a valid pickup location and emergency type before searching.');
      return;
    }
    setConfirmedLocation(location);
    setCurrentStep('searching');
    setIsSearching(true);
    setSearchError(null);
    setCoordinationError(null);
    setRecommendations([]);
    setSelectedFacility(null);
    setEmergencyRequestId(null);
    idempotencyKeyRef.current = null;
    try {
      const data = await emergencyApi.discover(location.latitude, location.longitude, selectedSituationId, searchRadius);
      const facilities = data.items.map(toFacility);
      setRecommendations(getRecommendedFacilities(selectedSituationId, facilities));
      setCurrentStep('recommendations');
      if (facilities.length === 0) setSearchError(null);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Could not load verified emergency hospitals.');
      setCurrentStep('recommendations');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectRecommendation = useCallback((item: FacilityRecommendationItem) => {
    setSelectedFacility(item.facility);
    setCoordinationError(null);
    setCurrentStep('confirmation');
  }, []);

  const handleConfirmEmergency = async () => {
    if (!selectedFacility || !selectedSituation || !confirmedLocation || isCreatingRequest) return;
    setIsCreatingRequest(true);
    setCoordinationError(null);
    try {
      // Recheck active requests at submit time to protect against stale tabs and repeat submissions.
      const active = await queryClient.fetchQuery({ queryKey: activeEmergencyQueryKey, queryFn: loadActiveEmergency, staleTime: 0 });
      if (active) {
        setEmergencyRequestId(active.id);
        setSelectedSituationId(situationIdForLabel(active.situationType));
        let activeFacility = fallbackFacility(active.hospitalId);
        try { activeFacility = await facilityApi.getById(active.hospitalId); } catch { /* preserve request visibility */ }
        setSelectedFacility(activeFacility);
        setCurrentStep('coordination');
        return;
      }
      // Refresh eligibility immediately before confirmation; never trust a stale availability badge.
      const latest = await emergencyApi.discover(
        confirmedLocation.latitude, confirmedLocation.longitude, selectedSituation.id, searchRadius, false,
      );
      const current = latest.items.find((item) => item.id === selectedFacility.id);
      if (!current) {
        setRecommendations(getRecommendedFacilities(selectedSituation.id, latest.items.map(toFacility)));
        setSelectedFacility(null);
        setCurrentStep('recommendations');
        setCoordinationError('This hospital is no longer eligible for this emergency. Choose another verified destination.');
        return;
      }
      const refreshedFacility = {
        ...toFacility(current),
        distance: selectedFacility.distance,
        distanceMeters: selectedFacility.distanceMeters,
        distanceType: selectedFacility.distanceType,
        estimatedTime: selectedFacility.estimatedTime,
        routeSummary: selectedFacility.routeSummary,
      };
      setSelectedFacility(refreshedFacility);
      const key = idempotencyKeyRef.current ?? (globalThis.crypto?.randomUUID?.() ?? `resq-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      idempotencyKeyRef.current = key;
      const request = await emergencyApi.create({
        hospitalId: refreshedFacility.id,
        situationType: selectedSituation.label,
        category: selectedSituation.id,
        location: confirmedLocation.label,
        latitude: confirmedLocation.latitude,
        longitude: confirmedLocation.longitude,
      }, key);
      setEmergencyRequestId(request.id);
      setSelectedFacility({
        ...refreshedFacility,
        distance: typeof request.routeDistanceMeters === 'number' ? formatDistance(request.routeDistanceMeters) : refreshedFacility.distance,
        distanceMeters: request.routeDistanceMeters ?? refreshedFacility.distanceMeters,
        distanceType: typeof request.routeDistanceMeters === 'number' ? 'DRIVING' : refreshedFacility.distanceType,
        estimatedTime: typeof request.etaMinutes === 'number' ? request.etaMinutes + ' min' : 'Driving ETA unavailable',
      });
      idempotencyKeyRef.current = null;
      await queryClient.invalidateQueries({ queryKey: activeEmergencyQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['user', 'emergencies'] });
      setCurrentStep('coordination');
      if (typeof request.etaMinutes !== 'number') {
        setCoordinationError('Your request was saved, but live driving ETA is unavailable. Keep 112 available and contact the hospital if needed.');
      }
    } catch (error) {
      setCoordinationError(error instanceof Error ? error.message : 'The emergency request could not be confirmed. Retry safely or call 112.');
    } finally {
      setIsCreatingRequest(false);
    }
  };

  const mapMarkers = useMemo(() => recommendations.flatMap((item) => {
    const { latitude, longitude } = item.facility;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return [];
    return [{
      id: item.facility.id,
      latitude,
      longitude,
      title: item.facility.name,
      subtitle: item.facility.address,
      isEmergency: true,
      isSelected: selectedFacility?.id === item.facility.id,
      onClick: () => handleSelectRecommendation(item),
    }];
  }), [recommendations, selectedFacility?.id, handleSelectRecommendation]);

  const meta = currentStep === 'situation'
    ? { step: 1, label: 'Situation' }
    : currentStep === 'location'
      ? { step: 2, label: 'Location' }
      : currentStep === 'coordination'
        ? { step: 5, label: 'Coordination' }
        : currentStep === 'confirmation'
          ? { step: 4, label: 'Confirm SOS' }
          : { step: 3, label: 'Care Options' };

  return (
    <EmergencyMode stepNumber={meta.step} totalSteps={5} currentStepLabel={meta.label} onExit={() => navigate('/')}>
      {activeRequestQuery.isLoading && !emergencyRequestId && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">Checking for an existing emergency request…</div>
      )}
      {activeRequestQuery.isError && !emergencyRequestId && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Could not check existing requests. Refresh this check before confirming SOS to avoid creating a duplicate.
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void activeRequestQuery.refetch()}>Retry check</Button>
        </div>
      )}
      {currentStep === 'situation' && (
        <SituationSelector
          selectedSituation={selectedSituationId}
          onSelectSituation={setSelectedSituationId}
          onContinue={() => selectedSituationId && setCurrentStep('location')}
        />
      )}
      {currentStep === 'location' && (
        <LocationConfirmation
          currentLocation={confirmedLocation ?? currentLocation}
          onConfirmLocation={handleLocationConfirm}
          onBack={() => setCurrentStep('situation')}
          isLocationUnavailable={locationUnavailable}
          onRetryLocation={refreshLocation}
        />
      )}
      {currentStep === 'searching' && isSearching && <EmergencySearchState situationLabel={selectedSituation?.label} />}
      {currentStep === 'recommendations' && !isSearching && (
        <div className="flex-1 space-y-5">
          <button type="button" onClick={() => setCurrentStep('location')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Change location
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Hospitals for {selectedSituation?.label ?? 'your emergency'}</h2>
            <p className="mt-1 text-xs text-slate-500">Verified facilities matched by declared capabilities, current emergency intake and geographic proximity. Driving ETAs are provided only when routing succeeds.</p>
          </div>
          {coordinationError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{coordinationError}</div>}
          {searchError && (
            <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-white p-5 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-rose-700" />
              <h3 className="text-sm font-bold text-slate-900">Hospital search needs attention</h3>
              <p className="text-xs text-slate-600">{searchError}</p>
              <Button variant="outline" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void handleLocationConfirm(flowLocation)}>Retry search</Button>
              <Button variant="emergency" size="sm" icon={<Phone className="h-3.5 w-3.5" />} onClick={() => { window.location.href = 'tel:112'; }}>Call 112</Button>
            </div>
          )}
          {!searchError && recommendations.length === 0 && (
            <div role="status" className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-center">
              <Building2 className="mx-auto h-6 w-6 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">No eligible hospital found</h3>
              <p className="text-xs text-slate-500">No verified hospital with a declared matching capability and eligible emergency intake was found within {Math.round(searchRadius / 1000)} km.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="emergency" size="md" icon={<Phone className="h-4 w-4" />} onClick={() => { window.location.href = 'tel:112'; }}>Call 112</Button>
                {searchRadius < 100000 && <Button variant="outline" size="md" onClick={() => { const next = Math.min(100000, searchRadius * 2); setSearchRadius(next); void handleLocationConfirm(flowLocation); }}>Search a wider radius</Button>}
              </div>
            </div>
          )}
          {recommendations.length > 0 && (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <MapView
                  center={confirmedLocation ? { latitude: confirmedLocation.latitude, longitude: confirmedLocation.longitude } : undefined}
                  userLocation={confirmedLocation ?? undefined}
                  markers={mapMarkers}
                  interactive
                  className="h-[260px] sm:h-[340px]"
                />
              </div>
              <div role="feed" aria-label="Verified emergency hospitals" className="space-y-3">
                {recommendations.map((item, index) => <FacilityRecommendation key={item.facility.id} item={item} isPrimary={index === 0} onSelect={handleSelectRecommendation} onViewDetails={(chosen) => navigate(`/facility/${chosen.facility.id}?emergency=true`)} />)}
              </div>
            </>
          )}
        </div>
      )}
      {currentStep === 'confirmation' && selectedFacility && confirmedLocation && selectedSituation && (
        <div className="flex-1 space-y-5">
          <button type="button" onClick={() => setCurrentStep('recommendations')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Choose another hospital
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Final confirmation</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Confirm emergency request</h2>
            <p className="mt-1 text-sm text-slate-600">Review your emergency type, pickup location and destination. ResQ will recheck hospital eligibility before saving the request.</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <MapView
              center={typeof selectedFacility.latitude === 'number' && typeof selectedFacility.longitude === 'number' ? { latitude: selectedFacility.latitude, longitude: selectedFacility.longitude } : { latitude: confirmedLocation.latitude, longitude: confirmedLocation.longitude }}
              userLocation={confirmedLocation}
              destination={typeof selectedFacility.latitude === 'number' && typeof selectedFacility.longitude === 'number' ? { latitude: selectedFacility.latitude, longitude: selectedFacility.longitude, name: selectedFacility.name, address: selectedFacility.address, isEmergency: true } : undefined}
              interactive
              className="h-[240px] sm:h-[320px]"
            />
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-50 p-2 text-rose-700"><ShieldCheck className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Emergency type</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedSituation.label}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-slate-100 pt-3">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pickup location</p><p className="mt-1 font-semibold text-slate-900">{confirmedLocation.label}</p><p className="mt-1 font-mono text-[11px] text-slate-500">{confirmedLocation.latitude.toFixed(5)}, {confirmedLocation.longitude.toFixed(5)}</p></div>
            </div>
            <div className="flex items-start gap-3 border-t border-slate-100 pt-3">
              <Building2 className="mt-1 h-5 w-5 shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{selectedFacility.name}</p><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"><CheckCircle2 className="h-3 w-3" /> Verified</span></div>
                <p className="mt-1 text-xs text-slate-600">{selectedFacility.address || 'Address unavailable'}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700"><span><strong>{selectedFacility.distance}</strong> {selectedFacility.distanceMeters ? (selectedFacility.distanceType === 'DRIVING' ? 'driving distance' : 'straight-line distance') : ''}</span><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{selectedFacility.estimatedTime || 'Driving ETA unavailable'}</span></p>
                {selectedFacility.phone && <p className="mt-2 text-xs text-slate-600">Contact: {selectedFacility.phone}</p>}
                {selectedFacility.capabilities.length > 0 && <p className="mt-2 text-xs text-slate-600">Declared capabilities: {selectedFacility.capabilities.slice(0, 5).join(', ')}</p>}
              </div>
            </div>
          </div>
          {selectedFacility.estimatedTime === 'Driving ETA unavailable' && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Google Routes could not provide a driving ETA. ResQ will not invent one; the request can still be saved, and direct emergency calling remains available.</div>}
          {coordinationError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{coordinationError}</div>}
          <div className="sticky bottom-0 space-y-2 border-t border-slate-200 bg-slate-50/95 py-3 backdrop-blur-sm">
            <Button variant="emergency" size="lg" fullWidth disabled={isCreatingRequest || activeRequestQuery.isError} onClick={() => void handleConfirmEmergency()}>
              {isCreatingRequest ? 'Validating hospital and saving request…' : 'Confirm SOS request'}
            </Button>
            <p className="text-center text-[11px] text-slate-500">This creates a hospital-coordination request. It does not dispatch an ambulance automatically.</p>
            <button type="button" className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-semibold text-rose-700" onClick={() => { window.location.href = 'tel:112'; }}><Phone className="h-3.5 w-3.5" /> Call 112 instead</button>
          </div>
        </div>
      )}
      {currentStep === 'coordination' && selectedFacility && (
        <CoordinationStatus
          facility={selectedFacility}
          onExit={() => navigate('/profile')}
          emergencyRequestId={emergencyRequestId}
          isCreatingRequest={isCreatingRequest}
          error={coordinationError}
        />
      )}
    </EmergencyMode>
  );
};
