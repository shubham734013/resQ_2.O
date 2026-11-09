export interface GoogleMapSubStyle {
  color?: string;
  visibility?: 'on' | 'off' | 'simplified';
  weight?: number;
  lightness?: number;
  saturation?: number;
}

export interface GoogleMapStyleItem {
  featureType?: string;
  elementType?: string;
  stylers: GoogleMapSubStyle[];
}

/**
 * Native Google Maps Dark Mode Style Object for resQ 2.O
 * Unified Dark Obsidian Glassmorphism Design System:
 * - Water bodies in dark obsidian: #050507
 * - Roads in deep dark gray: #18181b / #27272a
 * - Terrain & Landscape in deep zinc: #090a0c / #121316 / #18181b
 * - Legible telemetry typography: #a1a1aa / #71717a with #090a0c strokes
 */
export const darkMapStyle: GoogleMapStyleItem[] = [
  { elementType: 'geometry', stylers: [{ color: '#090a0c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#090a0c' }, { weight: 2 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#71717a' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#18181b' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#27272a' }],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a1a1aa' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0e1114' }, { visibility: 'simplified' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{ color: '#1c1917' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#18181b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#121215' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#71717a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#27272a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#18181b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a1a1aa' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#1c1d22' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#141418' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#18181b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#71717a' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#050507' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3f3f46' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#050507' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#0c0d10' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#101115' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#0c0d10' }],
  },
  {
    featureType: 'landscape.natural.terrain',
    elementType: 'geometry',
    stylers: [{ color: '#18181b' }],
  },
];

