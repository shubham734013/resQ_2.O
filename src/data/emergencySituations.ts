import type { Facility } from '../types/facility';
import type {
  EmergencySituation,
  EmergencySituationId,
  FacilityRecommendationItem,
} from '../types/emergency';

export const EMERGENCY_SITUATIONS: EmergencySituation[] = [
  {
    id: 'accident_injury',
    label: 'Accident / Injury',
    description: 'Physical impact, collisions, falls, or orthopedic trauma',
    recommendedCapabilities: ['Level 1 Adult & Pediatric Trauma', 'Trauma Care (Level 1)', 'Rapid Triage'],
    preferredCategory: 'trauma',
  },
  {
    id: 'severe_bleeding',
    label: 'Severe Bleeding',
    description: 'Deep wounds, active hemorrhage, or uncontrolled bleeding',
    recommendedCapabilities: ['Level 1 Adult & Pediatric Trauma', 'Emergency Department', 'Rapid Triage'],
    preferredCategory: 'trauma',
  },
  {
    id: 'breathing_difficulty',
    label: 'Breathing Difficulty',
    description: 'Acute respiratory distress, choking, or severe shortness of breath',
    recommendedCapabilities: ['Emergency Department', 'Intensive Care Unit (ICU)', 'Adult Emergency Room'],
    preferredCategory: 'emergency',
  },
  {
    id: 'chest_pain',
    label: 'Chest Pain',
    description: 'Pressure, tightness, or discomfort in the chest region',
    recommendedCapabilities: ['STEMI Cardiac Center', 'Cardiology & Cath Lab', 'Cardiology', 'Emergency Department'],
    preferredCategory: 'emergency',
  },
  {
    id: 'stroke_symptoms',
    label: 'Stroke-like Symptoms',
    description: 'Facial drooping, arm weakness, or sudden speech difficulty',
    recommendedCapabilities: ['Comprehensive Stroke Center', 'Neurology & Stroke Center', 'Neurology & Neuro ICU'],
    preferredCategory: 'emergency',
  },
  {
    id: 'unconscious_person',
    label: 'Unconscious Person',
    description: 'Unresponsive individual, syncope, or altered consciousness',
    recommendedCapabilities: ['Emergency Department', 'Rapid Triage', 'Intensive Care Unit (ICU)'],
    preferredCategory: 'emergency',
  },
  {
    id: 'burn',
    label: 'Burn',
    description: 'Thermal, chemical, or high-temperature burn injuries',
    recommendedCapabilities: ['Emergency Department', 'Rapid Triage', 'Trauma Care (Level 1)'],
    preferredCategory: 'emergency',
  },
  {
    id: 'other',
    label: 'Other Acute Situation',
    description: 'Other urgent healthcare situations requiring immediate medical care',
    recommendedCapabilities: ['Emergency Department', 'Rapid Triage'],
    preferredCategory: 'emergency',
  },
];

export function getRecommendedFacilities(
  situationId: EmergencySituationId,
  facilities: Facility[]
): FacilityRecommendationItem[] {
  const situation = EMERGENCY_SITUATIONS.find((s) => s.id === situationId);
  const preferredCapabilities = situation?.recommendedCapabilities ?? [];

  // Filter facilities that are open and offer acute emergency or urgent care
  const eligible = facilities.filter(
    (f) => (f.isAvailable ?? f.isOpen) && f.emergencyAvailable
  );

  const scored = eligible.map((facility) => {
    let score = 0;
    const allFacilityCapabilities = [
      ...facility.capabilities,
      ...(facility.departments ?? []),
    ].map((c) => c.toLowerCase());

    // 1. Capability match score (highest weight)
    let matchedCapabilityName = facility.capabilities[0] ?? 'Emergency Department';
    for (const pref of preferredCapabilities) {
      const match = allFacilityCapabilities.find((c) =>
        c.includes(pref.toLowerCase())
      );
      if (match) {
        score += 40;
        matchedCapabilityName = pref;
        break;
      }
    }

    // 2. Category preference
    if (situation?.preferredCategory && facility.category === situation.preferredCategory) {
      score += 25;
    }

    // 3. 24/7 Emergency availability
    if (facility.emergencyAvailable) {
      score += 20;
    }

    // 4. Verification and freshness
    if (facility.verified) {
      score += 10;
    }
    if (!facility.isStale) {
      score += 5;
    }

    // 5. Distance weighting (closer facilities score higher)
    const distanceKm = facility.distanceMeters / 1000;
    score += Math.max(0, 15 - distanceKm * 3);

    // Build neutral, objective recommendation reason
    let reason = 'Recommended because emergency care is available 24/7.';
    if (situationId === 'accident_injury' || situationId === 'severe_bleeding') {
      reason = 'Recommended because specialized trauma services and acute triage are available on-site.';
    } else if (situationId === 'chest_pain') {
      reason = 'Recommended because cardiac cath lab and emergency care services are active.';
    } else if (situationId === 'stroke_symptoms') {
      reason = 'Recommended because comprehensive stroke and acute neurological care are available.';
    } else if (situationId === 'breathing_difficulty') {
      reason = 'Recommended because 24/7 emergency care and ICU monitoring beds are operational.';
    } else if (situationId === 'unconscious_person') {
      reason = 'Recommended because emergency triage and acute resuscitation units are on-site.';
    } else if (situationId === 'burn') {
      reason = 'Recommended because emergency wound stabilization and acute trauma care are active.';
    }

    return {
      facility,
      reason,
      matchScore: score,
      highlightCapability: matchedCapabilityName,
    };
  });

  // Sort by match score descending
  return scored.sort((a, b) => b.matchScore - a.matchScore);
}
