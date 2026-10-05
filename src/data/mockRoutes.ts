import type { Facility, UserLocation } from '../types/facility';
import type { RouteOptionItem, NavigationInstruction, RouteCoordinate } from '../types/route';

/**
 * Calculates normalized SVG canvas coordinate percentage (0 - 100) based on geographic coordinates.
 * Center is user location at (50, 50).
 */
export const calculateMapPosition = (
  lat: number,
  lng: number,
  centerLat = 37.7749,
  centerLng = -122.4194
): RouteCoordinate => {
  const deltaLat = lat - centerLat;
  const deltaLng = lng - centerLng;

  const rawX = 50 + deltaLng * 550;
  const rawY = 50 - deltaLat * 800;

  return {
    x: Math.round(Math.max(12, Math.min(88, rawX)) * 10) / 10,
    y: Math.round(Math.max(16, Math.min(84, rawY)) * 10) / 10,
    latitude: lat,
    longitude: lng,
  };
};

/**
 * Generates mock routes (recommended and alternative) for a target healthcare facility.
 * Designed to provide realistic telemetry, step instructions, and SVG polylines.
 */
export const getMockRoutesForFacility = (
  facility: Facility,
  userLocation: UserLocation = {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 'high',
    label: 'Downtown Financial District, San Francisco',
  }
): RouteOptionItem[] => {
  const startCoord: RouteCoordinate = {
    x: 50,
    y: 50,
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
  };

  const destCoord = calculateMapPosition(
    facility.latitude,
    facility.longitude,
    userLocation.latitude,
    userLocation.longitude
  );

  const dx = destCoord.x - startCoord.x;
  const dy = destCoord.y - startCoord.y;

  // Polyline for Recommended Route (direct arterial route)
  const recommendedPolyline: RouteCoordinate[] = [
    startCoord,
    { x: Math.round((startCoord.x + dx * 0.15) * 10) / 10, y: Math.round((startCoord.y + (dy > 0 ? 4 : -4)) * 10) / 10 },
    { x: Math.round((startCoord.x + dx * 0.45) * 10) / 10, y: Math.round((startCoord.y + dy * 0.35) * 10) / 10 },
    { x: Math.round((startCoord.x + dx * 0.75) * 10) / 10, y: Math.round((startCoord.y + dy * 0.72) * 10) / 10 },
    { x: Math.round((destCoord.x - (dx > 0 ? 3 : -3)) * 10) / 10, y: Math.round((destCoord.y - (dy > 0 ? 3 : -3)) * 10) / 10 },
    destCoord,
  ];

  // Polyline for Alternative Route (peripheral / bypass route)
  const alternativePolyline: RouteCoordinate[] = [
    startCoord,
    { x: Math.round((startCoord.x - (dx > 0 ? 8 : -8)) * 10) / 10, y: Math.round((startCoord.y + dy * 0.2) * 10) / 10 },
    { x: Math.round((startCoord.x + dx * 0.3) * 10) / 10, y: Math.round((startCoord.y + dy * 0.6) * 10) / 10 },
    { x: Math.round((startCoord.x + dx * 0.9) * 10) / 10, y: Math.round((startCoord.y + dy * 0.88) * 10) / 10 },
    destCoord,
  ];

  // Parse numeric duration from facility string like "11 min"
  const rawMin = parseInt(facility.estimatedTime.replace(/[^0-9]/g, ''), 10) || 10;
  const rawDistance = parseFloat(facility.distance.replace(/[^0-9.]/g, '')) || 2.4;

  const altMin = rawMin + 3;
  const altDistance = (rawDistance + 0.7).toFixed(1);

  // Turn-by-turn instructions for recommended route
  const recommendedInstructions: NavigationInstruction[] = [
    {
      id: 'step-1',
      stepNumber: 1,
      maneuver: 'straight',
      instruction: 'Head north on Pine Street toward 4th Ave',
      streetName: 'Pine Street',
      distanceToNext: '250 m',
      remainingTime: `${rawMin} min`,
      remainingDistance: `${rawDistance} km`,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      maneuver: 'turn-right',
      instruction: 'In 300 m turn right onto Market Street',
      streetName: 'Market Street',
      distanceToNext: '300 m',
      remainingTime: `${Math.max(1, rawMin - 2)} min`,
      remainingDistance: `${Math.max(0.2, rawDistance - 0.3).toFixed(1)} km`,
    },
    {
      id: 'step-3',
      stepNumber: 3,
      maneuver: 'straight',
      instruction: 'Continue straight on Market Street for 1.2 km',
      streetName: 'Market Street',
      distanceToNext: '1.2 km',
      remainingTime: `${Math.max(1, rawMin - 5)} min`,
      remainingDistance: `${Math.max(0.2, rawDistance - 0.9).toFixed(1)} km`,
    },
    {
      id: 'step-4',
      stepNumber: 4,
      maneuver: 'turn-left',
      instruction: `Turn left onto ${facility.address.split(',')[0] || 'Hospital Way'}`,
      streetName: facility.address.split(',')[0] || 'Hospital Way',
      distanceToNext: '450 m',
      remainingTime: '3 min',
      remainingDistance: '0.6 km',
    },
    {
      id: 'step-5',
      stepNumber: 5,
      maneuver: 'turn-right',
      instruction: facility.emergencyAvailable
        ? 'Turn right into Emergency Ambulance & Triage Bay'
        : 'Turn right into Main Facility Entrance & Parking',
      streetName: 'Facility Drive',
      distanceToNext: '150 m',
      remainingTime: '1 min',
      remainingDistance: '0.2 km',
    },
    {
      id: 'step-6',
      stepNumber: 6,
      maneuver: 'arrive',
      instruction: `Arrive at ${facility.name}`,
      streetName: facility.name,
      distanceToNext: '0 m',
      remainingTime: '0 min',
      remainingDistance: '0 km',
    },
  ];

  // Turn-by-turn instructions for alternative route
  const alternativeInstructions: NavigationInstruction[] = [
    {
      id: 'alt-step-1',
      stepNumber: 1,
      maneuver: 'straight',
      instruction: 'Head west toward Embarcadero Bypass',
      streetName: 'Embarcadero Bypass',
      distanceToNext: '400 m',
      remainingTime: `${altMin} min`,
      remainingDistance: `${altDistance} km`,
    },
    {
      id: 'alt-step-2',
      stepNumber: 2,
      maneuver: 'slight-right',
      instruction: 'Take ramp onto Bay Expressway North',
      streetName: 'Bay Expressway',
      distanceToNext: '1.8 km',
      remainingTime: `${Math.max(1, altMin - 3)} min`,
      remainingDistance: `${(parseFloat(altDistance) - 0.5).toFixed(1)} km`,
    },
    {
      id: 'alt-step-3',
      stepNumber: 3,
      maneuver: 'turn-left',
      instruction: 'Take Exit 7 toward Medical Center Corridor',
      streetName: 'Exit 7 Corridor',
      distanceToNext: '600 m',
      remainingTime: '4 min',
      remainingDistance: '0.9 km',
    },
    {
      id: 'alt-step-4',
      stepNumber: 4,
      maneuver: 'arrive',
      instruction: `Arrive at ${facility.name} via West Access`,
      streetName: facility.name,
      distanceToNext: '0 m',
      remainingTime: '0 min',
      remainingDistance: '0 km',
    },
  ];

  const recommendedRoute: RouteOptionItem = {
    id: 'route-recommended',
    name: 'Recommended',
    distance: `${rawDistance} km`,
    duration: `${rawMin} min`,
    durationSeconds: rawMin * 60,
    trafficCondition: 'moderate',
    summary: 'Fastest route with typical traffic via Market St & arterial corridor.',
    viaRoute: 'via Market St & Hospital Dr',
    isRecommended: true,
    polylinePoints: recommendedPolyline,
    instructions: recommendedInstructions,
  };

  const alternativeRoute: RouteOptionItem = {
    id: 'route-alternative',
    name: 'Alternative',
    distance: `${altDistance} km`,
    duration: `${altMin} min`,
    durationSeconds: altMin * 60,
    trafficCondition: 'light',
    summary: 'Alternative via Bay Expressway. Avoids downtown traffic lights.',
    viaRoute: 'via Bay Expressway North',
    isRecommended: false,
    polylinePoints: alternativePolyline,
    instructions: alternativeInstructions,
  };

  return [recommendedRoute, alternativeRoute];
};
