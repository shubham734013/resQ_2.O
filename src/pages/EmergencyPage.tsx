import { useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  RefreshCw,
  Phone,
  ArrowLeft,
} from 'lucide-react';
import type { Facility, UserLocation } from '../types/facility';
import type {
  EmergencyFlowStep,
  EmergencySituationId,
  FacilityRecommendationItem,
} from '../types/emergency';
import { EMERGENCY_SITUATIONS, getRecommendedFacilities } from '../data/emergencySituations';
import { MOCK_FACILITIES } from '../data/mockFacilities';
import { EmergencyMode } from '../components/emergency/EmergencyMode';
import { SituationSelector } from '../components/emergency/SituationSelector';
import { LocationConfirmation } from '../components/emergency/LocationConfirmation';
import { EmergencySearchState } from '../components/emergency/EmergencySearchState';
import { FacilityRecommendation } from '../components/emergency/FacilityRecommendation';
import { CoordinationStatus } from '../components/emergency/CoordinationStatus';
import { Button } from '../components/common/Button';

interface LayoutContext {
  currentLocation: UserLocation;
  refreshLocation: () => void;
  isUpdating: boolean;
}

export const EmergencyPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentLocation } = useOutletContext<LayoutContext>();

  // Check if redirected with pre-selected facility (e.g. from /facility/:id back to emergency coordination)
  const preselectedId = searchParams.get('facility');
  const preselectedFacility = preselectedId
    ? MOCK_FACILITIES.find((f) => f.id === preselectedId) ?? null
    : null;

  // Flow State
  const [currentStep, setCurrentStep] = useState<EmergencyFlowStep>(
    preselectedFacility ? 'coordination' : 'situation'
  );
  const [selectedSituationId, setSelectedSituationId] = useState<EmergencySituationId | null>(null);
  const [confirmedLocation, setConfirmedLocation] = useState<UserLocation>(currentLocation);
  const [recommendations, setRecommendations] = useState<FacilityRecommendationItem[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    preselectedFacility
  );

  // Simulated failure/edge states for prototype demonstration
  const [isSimulatingSearch, setIsSimulatingSearch] = useState(false);
  const [hasSearchError, setHasSearchError] = useState(false);
  const [hasNoFacilitiesError, setHasNoFacilitiesError] = useState(false);
  const [isLocationUnavailable, setIsLocationUnavailable] = useState(false);

  // Step 1 -> Step 2
  const handleSituationContinue = () => {
    if (!selectedSituationId) return;
    setCurrentStep('location');
  };

  // Step 2 -> Step 3 (Finding Care) -> Step 4 (Recommendations)
  const handleLocationConfirm = (location: UserLocation) => {
    setConfirmedLocation(location);
    setCurrentStep('searching');
    setIsSimulatingSearch(true);

    // Simulate short intelligent search (~900ms)
    setTimeout(() => {
      if (hasSearchError) {
        setIsSimulatingSearch(false);
        return;
      }

      if (hasNoFacilitiesError) {
        setRecommendations([]);
        setIsSimulatingSearch(false);
        setCurrentStep('recommendations');
        return;
      }

      const recs = getRecommendedFacilities(
        selectedSituationId ?? 'other',
        MOCK_FACILITIES
      );
      setRecommendations(recs);
      setIsSimulatingSearch(false);
      setCurrentStep('recommendations');
    }, 900);
  };

  // Step 4 -> Step 5 (Select Recommendation)
  const handleSelectRecommendation = (item: FacilityRecommendationItem) => {
    setSelectedFacility(item.facility);
    setCurrentStep('coordination');
  };

  // Step 4: View Details
  const handleViewDetails = (item: FacilityRecommendationItem) => {
    navigate(`/facility/${item.facility.id}?emergency=true`);
  };

  // Exit Emergency Mode safely
  const handleExitEmergency = () => {
    navigate('/');
  };

  const selectedSituation = EMERGENCY_SITUATIONS.find((s) => s.id === selectedSituationId);

  // Determine header step metadata
  const getStepMetadata = () => {
    switch (currentStep) {
      case 'situation':
        return { step: 1, label: 'Situation' };
      case 'location':
        return { step: 2, label: 'Location' };
      case 'searching':
      case 'recommendations':
        return { step: 3, label: 'Care Options' };
      case 'coordination':
        return { step: 4, label: 'Coordination' };
    }
  };

  const { step, label } = getStepMetadata();

  return (
    <EmergencyMode
      stepNumber={step}
      totalSteps={4}
      currentStepLabel={label}
      onExit={handleExitEmergency}
    >
      {/* ========================================================
          STEP 1: EMERGENCY SITUATION SELECTION
          ======================================================== */}
      {currentStep === 'situation' && (
        <SituationSelector
          selectedSituation={selectedSituationId}
          onSelectSituation={setSelectedSituationId}
          onContinue={handleSituationContinue}
        />
      )}

      {/* ========================================================
          STEP 2: LOCATION CONFIRMATION
          ======================================================== */}
      {currentStep === 'location' && (
        <LocationConfirmation
          currentLocation={confirmedLocation}
          onConfirmLocation={handleLocationConfirm}
          onBack={() => setCurrentStep('situation')}
          isLocationUnavailable={isLocationUnavailable}
          onRetryLocation={() => setIsLocationUnavailable(false)}
        />
      )}

      {/* ========================================================
          STEP 3: FINDING SUITABLE CARE (SEARCHING ANIMATION)
          ======================================================== */}
      {currentStep === 'searching' && isSimulatingSearch && (
        <EmergencySearchState situationLabel={selectedSituation?.label} />
      )}

      {/* ========================================================
          STEP 4: RECOMMENDED FACILITIES
          ======================================================== */}
      {currentStep === 'recommendations' && !isSimulatingSearch && (
        <div className="space-y-6 flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header with Situation Summary & Back action */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep('location')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Location</span>
              </button>

              {selectedSituation && (
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                  For: {selectedSituation.label}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                Recommended Facilities
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Ranked by active emergency intake readiness, relevant clinical capability, and driving transit time.
              </p>
            </div>

            {/* Error State Fallback */}
            {hasSearchError && (
              <div
                role="alert"
                className="p-5 bg-white border border-rose-200 rounded-xl text-center space-y-3 shadow-xs"
              >
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Connection Error</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Could not retrieve live hospital readiness data. You can retry or call emergency services directly.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setHasSearchError(false);
                      handleLocationConfirm(confirmedLocation);
                    }}
                  >
                    Retry Search
                  </Button>
                  <Button
                    variant="emergency"
                    size="sm"
                    icon={<Phone className="w-3.5 h-3.5" />}
                    onClick={() => {
                      window.location.href = 'tel:911';
                    }}
                  >
                    Call 911
                  </Button>
                </div>
              </div>
            )}

            {/* No Facilities Found State */}
            {!hasSearchError && recommendations.length === 0 && (
              <div
                role="alert"
                className="p-6 bg-white border border-slate-200 rounded-xl text-center space-y-4 shadow-xs"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">No Suitable Facility Found Nearby</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    No verified facilities within immediate radius currently report active intake for {selectedSituation?.label}. Please call emergency services immediately.
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-2">
                  <Button
                    variant="emergency"
                    size="md"
                    icon={<Phone className="w-4 h-4" />}
                    onClick={() => {
                      window.location.href = 'tel:911';
                    }}
                  >
                    Call Emergency 911
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setHasNoFacilitiesError(false);
                      handleLocationConfirm(confirmedLocation);
                    }}
                  >
                    Broaden Search Area
                  </Button>
                </div>
              </div>
            )}

            {/* Recommendation Cards List */}
            {!hasSearchError && recommendations.length > 0 && (
              <div
                role="feed"
                aria-label="Recommended facilities"
                className="space-y-3 pt-1"
              >
                {recommendations.map((item, idx) => (
                  <FacilityRecommendation
                    key={item.facility.id}
                    item={item}
                    isPrimary={idx === 0}
                    onSelect={handleSelectRecommendation}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          STEP 5: COORDINATION STATUS
          ======================================================== */}
      {currentStep === 'coordination' && selectedFacility && (
        <CoordinationStatus
          facility={selectedFacility}
          onExit={handleExitEmergency}
        />
      )}
    </EmergencyMode>
  );
};
