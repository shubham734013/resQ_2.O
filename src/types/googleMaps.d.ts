export interface GoogleLatLngLiteral { lat: number; lng: number; }
export interface GoogleMapOptions { center: GoogleLatLngLiteral; zoom: number; mapId?: string; streetViewControl?: boolean; mapTypeControl?: boolean; fullscreenControl?: boolean; clickableIcons?: boolean; }
export interface GoogleMapInstance { setCenter(center: GoogleLatLngLiteral): void; setZoom(zoom: number): void; fitBounds(bounds: GoogleLatLngBounds): void; }
export interface GoogleLatLngBounds { extend(point: GoogleLatLngLiteral): void; }
export interface GooglePolylineOptions { map?: GoogleMapInstance; path: GoogleLatLngLiteral[]; strokeColor?: string; strokeOpacity?: number; strokeWeight?: number; clickable?: boolean; }
export interface GooglePolyline { setMap(map: GoogleMapInstance | null): void; }
export interface GoogleMapsApi { maps: { importLibrary(name: 'maps' | 'marker' | 'places' | 'geometry'): Promise<Record<string, unknown>>; Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMapInstance; LatLngBounds: new () => GoogleLatLngBounds; Polyline: new (options: GooglePolylineOptions) => GooglePolyline; }; }