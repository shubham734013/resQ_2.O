import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Minus, Plus, RefreshCw } from 'lucide-react';
import type { MapViewProps } from '../../types/route';
import type { GoogleAdvancedMarker, GoogleMapInstance, GoogleMapsApi, GooglePolyline } from '../../types/googleMaps';
import { loadGoogleMaps } from '../../services/googleMapsLoader';

interface AdvancedMarkerConstructor {
  new (options: { map: GoogleMapInstance; position: { lat: number; lng: number }; title?: string; content?: HTMLElement; gmpClickable?: boolean }): GoogleAdvancedMarker;
}

interface MapLibrary {
  Map: new (element: HTMLElement, options: { center: { lat: number; lng: number }; zoom: number; mapId?: string; streetViewControl?: boolean; mapTypeControl?: boolean; fullscreenControl?: boolean; clickableIcons?: boolean }) => GoogleMapInstance;
  LatLngBounds: new () => { extend(point: { lat: number; lng: number }): void };
  Polyline: new (options: { map?: GoogleMapInstance; path: { lat: number; lng: number }[]; strokeColor?: string; strokeOpacity?: number; strokeWeight?: number }) => GooglePolyline;
}

const toGoogle = (latitude: number, longitude: number) => ({ lat: latitude, lng: longitude });

const markerElement = (label: string, emergency = false): HTMLElement => {
  const element = document.createElement('button');
  element.type = 'button';
  element.setAttribute('aria-label', label);
  element.title = label;
  element.className = 'rounded-full border-2 border-white px-2 py-1 text-[10px] font-semibold shadow-md bg-white text-slate-800';
  if (emergency) element.className += ' text-rose-700';
  element.textContent = label;
  return element;
};

export const MapView = ({
  center,
  zoom = 14,
  userLocation,
  destination,
  markers = [],
  activeRoute = null,
  alternativeRoutes = [],
  onSelectRoute,
  interactive = true,
  onRecenter,
  className = '',
}: MapViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleAdvancedMarker[]>([]);
  const polylinesRef = useRef<GooglePolyline[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(zoom);

  const fallbackCenter = center ?? (userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : destination ?? { latitude: 0, longitude: 0 });

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      if (!containerRef.current) return;
      try {
        setStatus('loading');
        const googleMaps = await loadGoogleMaps();
        if (cancelled || !containerRef.current) return;
        const maps = await googleMaps.maps.importLibrary('maps') as unknown as MapLibrary;
        const mapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined)?.trim();
        mapRef.current = new maps.Map(containerRef.current, {
          center: toGoogle(fallbackCenter.latitude, fallbackCenter.longitude),
          zoom,
          ...(mapId ? { mapId } : {}),
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        setZoomLevel(zoom);
        setStatus('ready');
        setError(null);
      } catch (reason) {
        if (!cancelled) {
          setStatus('error');
          setError(reason instanceof Error ? reason.message : 'MAPS_API_LOAD_FAILED');
        }
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || status !== 'ready') return;
    mapRef.current.setCenter(toGoogle(fallbackCenter.latitude, fallbackCenter.longitude));
  }, [fallbackCenter.latitude, fallbackCenter.longitude, status]);

  useEffect(() => {
    let cancelled = false;
    const renderOverlays = async () => {
      if (!mapRef.current || status !== 'ready') return;
      const googleMaps = await loadGoogleMaps();
      const markerLibrary = await googleMaps.maps.importLibrary('marker');
      if (cancelled) return;
      const AdvancedMarkerElement = (markerLibrary as unknown as { AdvancedMarkerElement: AdvancedMarkerConstructor }).AdvancedMarkerElement;
      markersRef.current.forEach((marker) => { marker.map = null; });
      markersRef.current = [];
      polylinesRef.current.forEach((line) => line.setMap(null));
      polylinesRef.current = [];

      const allPoints: Array<{ lat: number; lng: number }> = [];
      if (userLocation && Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude)) {
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: toGoogle(userLocation.latitude, userLocation.longitude),
          title: 'Your current location',
          content: markerElement('You'),
        });
        markersRef.current.push(marker);
        allPoints.push(toGoogle(userLocation.latitude, userLocation.longitude));
      }

      for (const item of markers) {
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: toGoogle(item.latitude, item.longitude),
          title: item.title,
          content: markerElement(item.title, item.isEmergency),
          gmpClickable: Boolean(item.onClick),
        });
        if (item.onClick) marker.addListener('click', item.onClick);
        markersRef.current.push(marker);
        allPoints.push(toGoogle(item.latitude, item.longitude));
      }

      if (destination) {
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: toGoogle(destination.latitude, destination.longitude),
          title: destination.name,
          content: markerElement(destination.name, destination.isEmergency),
        });
        markersRef.current.push(marker);
        allPoints.push(toGoogle(destination.latitude, destination.longitude));
      }

      if (activeRoute?.googlePath?.length) {
        polylinesRef.current.push(new googleMaps.maps.Polyline({
          map: mapRef.current,
          path: activeRoute.googlePath.map((point) => toGoogle(point.latitude, point.longitude)),
          strokeColor: '#2563eb',
          strokeOpacity: 0.95,
          strokeWeight: 6,
        }));
      }

      for (const route of alternativeRoutes) {
        if (!route.googlePath?.length) continue;
        polylinesRef.current.push(new googleMaps.maps.Polyline({
          map: mapRef.current,
          path: route.googlePath.map((point) => toGoogle(point.latitude, point.longitude)),
          strokeColor: '#64748b',
          strokeOpacity: 0.55,
          strokeWeight: 4,
        }));
      }

      if (allPoints.length > 1 && !activeRoute?.googlePath?.length) {
        const bounds = new googleMaps.maps.LatLngBounds();
        allPoints.forEach((point) => bounds.extend(point));
        mapRef.current.fitBounds(bounds);
      }
    };
    void renderOverlays();
    return () => { cancelled = true; };
  }, [activeRoute, alternativeRoutes, destination, markers, status, userLocation]);

  const changeZoom = (delta: number) => {
    const next = Math.min(20, Math.max(2, zoomLevel + delta));
    setZoomLevel(next);
    mapRef.current?.setZoom(next);
  };

  const recenter = () => {
    if (!userLocation) {
      onRecenter?.();
      return;
    }
    mapRef.current?.setCenter(toGoogle(userLocation.latitude, userLocation.longitude));
    mapRef.current?.setZoom(16);
    setZoomLevel(16);
    onRecenter?.();
  };

  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-100 ${className}`} role="region" aria-label="Google map">
      <div ref={containerRef} className="absolute inset-0" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 z-10">
          <p className="text-sm font-medium text-slate-600">Loading Google Maps…</p>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-100 z-10">
          <div className="max-w-sm rounded-xl border border-rose-200 bg-white p-5 shadow-sm text-center">
            <p className="font-semibold text-slate-900">Map unavailable</p>
            <p className="mt-1 text-xs text-slate-500">{error === 'MAPS_API_KEY_MISSING' ? 'Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY to the frontend environment.' : 'Google Maps could not be loaded.'}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
          </div>
        </div>
      )}
      {status === 'ready' && interactive && (
        <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
          <button type="button" aria-label="Zoom in" onClick={() => changeZoom(1)} className="rounded-lg bg-white p-2 shadow-md"><Plus className="h-4 w-4" /></button>
          <button type="button" aria-label="Zoom out" onClick={() => changeZoom(-1)} className="rounded-lg bg-white p-2 shadow-md"><Minus className="h-4 w-4" /></button>
          <button type="button" aria-label="Center on me" onClick={recenter} disabled={!userLocation} className="rounded-lg bg-white p-2 shadow-md disabled:opacity-50"><LocateFixed className="h-4 w-4" /></button>
        </div>
      )}
      {status === 'ready' && alternativeRoutes.length > 0 && (
        <div className="absolute bottom-3 right-3 z-20 rounded-lg bg-white/95 px-3 py-2 shadow-md text-[11px] text-slate-600">
          {alternativeRoutes.map((route) => (
            <button key={route.id} type="button" onClick={() => onSelectRoute?.(route.id)} className="mr-2 font-semibold text-slate-800 last:mr-0">{route.name}</button>
          ))}
        </div>
      )}
    </div>
  );
};