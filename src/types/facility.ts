export type FacilityCategory =
  | 'all'
  | 'emergency'
  | 'trauma'
  | 'urgent_care'
  | 'pediatric'
  | 'cardiology'
  | 'neurology'
  | 'orthopaedics'
  | 'maternity'
  | 'multispeciality'
  | 'general';

export interface RouteSummary {
  distance: string;
  duration: string;
  viaRoute: string;
  trafficCondition: 'Light traffic' | 'Moderate traffic' | 'Heavy traffic';
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  category: FacilityCategory;
  distance: string;
  distanceMeters?: number;
  distanceType?: 'DRIVING' | 'STRAIGHT_LINE';
  estimatedTime: string;
  emergencyAvailable: boolean;
  verified: boolean;
  lastUpdated: string;
  latitude?: number;
  longitude?: number;
  address: string;
  phone: string;
  openStatus: string;
  isOpen: boolean;
  isAvailable?: boolean;
  isStale?: boolean;
  operatingStatus?: string;
  capabilities: string[];
  departments?: string[];
  triageWaitTime?: string;
  ambulanceAvailability?: 'Available' | 'Busy' | 'On Request' | 'Unavailable';
  rating?: number;
  routeSummary?: RouteSummary;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  label: string;
  accuracy: 'high' | 'approximate';
  accuracyMeters?: number;
  timestamp?: number;
}