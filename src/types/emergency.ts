import type { Facility, UserLocation } from './facility';

export type EmergencySituationId =
  | 'accident_injury'
  | 'severe_bleeding'
  | 'breathing_difficulty'
  | 'chest_pain'
  | 'stroke_symptoms'
  | 'unconscious_person'
  | 'burn'
  | 'other';

export interface EmergencySituation {
  id: EmergencySituationId;
  label: string;
  description: string;
  recommendedCapabilities: string[];
  preferredCategory?: 'trauma' | 'emergency' | 'urgent_care' | 'pediatric';
}

export type EmergencyFlowStep =
  | 'situation'
  | 'location'
  | 'searching'
  | 'recommendations'
  | 'coordination';

export interface FacilityRecommendationItem {
  facility: Facility;
  reason: string;
  matchScore: number;
  highlightCapability: string;
}

export type CoordinationStepStatus = 'completed' | 'in_progress' | 'pending';

export interface CoordinationStep {
  id: string;
  label: string;
  description: string;
  status: CoordinationStepStatus;
}

export interface EmergencyFlowState {
  currentStep: EmergencyFlowStep;
  selectedSituation: EmergencySituationId | null;
  confirmedLocation: UserLocation;
  selectedFacility: Facility | null;
  isSimulatingSearch: boolean;
  hasLocationError: boolean;
  hasNoFacilitiesError: boolean;
}
