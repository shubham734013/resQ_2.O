export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface GeoPoint extends MapCoordinate {
  accuracyMeters?: number;
  timestamp: number;
}

export interface FacilityMapItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  verificationStatus: string;
  emergencyAvailability: string;
  capabilities: string[];
  updatedAt: string;
}

export interface AmbulanceMapItem {
  id: string;
  status: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export interface PlaceSearchResult {
  id: string;
  displayName: string;
  formattedAddress?: string;
  location?: MapCoordinate;
}

export interface RouteRequest {
  origin: MapCoordinate;
  destination: MapCoordinate;
  travelMode?: 'DRIVE' | 'TWO_WHEELER' | 'WALK' | 'BICYCLE';
  routingPreference?: 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL' | 'TRAFFIC_UNAWARE';
}

export interface RouteOption {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
  polyline: MapCoordinate[];
  summary: string;
  trafficCondition?: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'UNKNOWN';
  recommended: boolean;
  instructions: Array<{ id: string; stepNumber: number; maneuver: 'straight' | 'turn-right' | 'turn-left' | 'slight-right' | 'slight-left' | 'u-turn' | 'arrive'; instruction: string; streetName: string; distanceToNext: string; remainingTime: string; remainingDistance: string }>;
}

export interface RouteResult {
  routes: RouteOption[];
  origin: MapCoordinate;
  destination: MapCoordinate;
  fetchedAt: string;
}

export type LocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'unknown';

export interface LocationState {
  location: GeoPoint | null;
  loading: boolean;
  permissionState: LocationPermissionState;
  error: string | null;
  refreshLocation: () => void;
}