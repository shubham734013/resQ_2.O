import type { UserLocation } from './facility';

export type TrafficCondition = 'light' | 'moderate' | 'heavy';

export type ManeuverType =
  | 'straight'
  | 'turn-right'
  | 'turn-left'
  | 'slight-right'
  | 'slight-left'
  | 'u-turn'
  | 'arrive';

export interface NavigationInstruction {
  id: string;
  stepNumber: number;
  maneuver: ManeuverType;
  instruction: string;
  streetName: string;
  distanceToNext: string;
  remainingTime: string;
  remainingDistance: string;
}

export interface RouteCoordinate {
  x: number; // Percentage on canvas 0-100
  y: number; // Percentage on canvas 0-100
  latitude?: number;
  longitude?: number;
}

export interface RouteOptionItem {
  id: string;
  name: string;
  distance: string;
  duration: string;
  durationSeconds: number;
  trafficCondition: TrafficCondition;
  summary: string;
  viaRoute: string;
  isRecommended: boolean;
  polylinePoints: RouteCoordinate[];
  instructions: NavigationInstruction[];
}

export type NavigationMode = 'preview' | 'navigating' | 'arrived' | 'unavailable';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  isEmergency?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

export interface MapViewProps {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  userLocation?: UserLocation;
  destination?: {
    latitude: number;
    longitude: number;
    name: string;
    address?: string;
    isEmergency?: boolean;
  };
  markers?: MapMarker[];
  activeRoute?: RouteOptionItem | null;
  alternativeRoutes?: RouteOptionItem[];
  onSelectRoute?: (routeId: string) => void;
  interactive?: boolean;
  isNavigating?: boolean;
  currentStepIndex?: number;
  onRecenter?: () => void;
  className?: string;
}
