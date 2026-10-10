import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Minus, Plus, RefreshCw } from 'lucide-react';
import type { MapViewProps } from '../../types/route';
import type { GoogleAdvancedMarker, GoogleMapInstance, GooglePolyline } from '../../types/googleMaps';
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

  // Keep the map useful before geolocation or a destination has been selected.
  const fallbackCenter = center ?? (userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : destination ?? { latitude: 22.9734, longitude: 78.6569 });

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      if (!containerRef.current) return;
      try {
        setStatus('loading');
        const googleMaps = await loadGoogleMaps();
        if (cancelled || !containerRef.current) return;
        const maps = await googleMaps.maps.importLibrary('maps') as unknown as MapLibrary;
        const mapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined)?.trim() || 'DEMO_MAP_ID';
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
  // Map construction is intentionally one-time; prop changes are applied by the following effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || status !== 'ready') return;
    mapRef.current.setCenter(toGoogle(fallbackCenter.latitude, fallbackCenter.longitude));
  }, [fallbackCenter.latitude, fallbackCenter.longitude, status]);

  // Desktop layouts can resize the map after its initial construction (for example,
  // when a sidebar opens). Observe the actual map element and re-apply its center.
  useEffect(() => {
    const element = containerRef.current;
    const map = mapRef.current;
    if (!element || !map || status !== 'ready') return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        map.setCenter(toGoogle(fallbackCenter.latitude, fallbackCenter.longitude));
      });
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [fallbackCenter.latitude, fallbackCenter.longitude, status]);

  useEffect(() => {
    let cancelled = false;
    const renderOverlays = async () => {
      if (!mapRef.current || status !== 'ready') return;
      try {
        const googleMaps = await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;
        const markerLibrary = await googleMaps.maps.importLibrary('marker');
        if (cancelled || !mapRef.current) return;
        const AdvancedMarkerElement = (markerLibrary as unknown as { AdvancedMarkerElement?: AdvancedMarkerConstructor })?.AdvancedMarkerElement;

        markersRef.current.forEach((marker) => {
          try { marker.map = null; } catch { /* ignore */ }
        });
        markersRef.current = [];
        polylinesRef.current.forEach((line) => {
          try { line.setMap(null); } catch { /* ignore */ }
        });
        polylinesRef.current = [];

        const allPoints: Array<{ lat: number; lng: number }> = [];

        const createMarker = (lat: number, lng: number, title: string, isEmergency = false, onClick?: () => void) => {
          if (!mapRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const pos = toGoogle(lat, lng);
          allPoints.push(pos);
          try {
            if (AdvancedMarkerElement) {
              const marker = new AdvancedMarkerElement({
                map: mapRef.current,
                position: pos,
                title,
                content: markerElement(title, isEmergency),
                gmpClickable: Boolean(onClick),
              });
              if (onClick) marker.addListener('click', onClick);
              markersRef.current.push(marker);
            }
          } catch (markerErr) {
            console.warn('AdvancedMarkerElement failed to instantiate, fallback omitted:', markerErr);
          }
        };

        if (userLocation && Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude)) {
          createMarker(userLocation.latitude, userLocation.longitude, 'You');
        }

        for (const item of markers) {
          if (Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) {
            createMarker(item.latitude, item.longitude, item.title, item.isEmergency, item.onClick);
          }
        }

        if (destination && Number.isFinite(destination.latitude) && Number.isFinite(destination.longitude)) {
          createMarker(destination.latitude, destination.longitude, destination.name, destination.isEmergency);
        }

        if (activeRoute?.googlePath?.length) {
          const path = activeRoute.googlePath
            .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
            .map((point) => toGoogle(point.latitude, point.longitude));
          if (path.length) {
            polylinesRef.current.push(new googleMaps.maps.Polyline({
              map: mapRef.current,
              path,
              strokeColor: '#2563eb',
              strokeOpacity: 0.95,
              strokeWeight: 6,
            }));
          }
        }

        for (const route of alternativeRoutes) {
          if (!route.googlePath?.length) continue;
          const path = route.googlePath
            .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
            .map((point) => toGoogle(point.latitude, point.longitude));
          if (path.length) {
            polylinesRef.current.push(new googleMaps.maps.Polyline({
              map: mapRef.current,
              path,
              strokeColor: '#64748b',
              strokeOpacity: 0.55,
              strokeWeight: 4,
            }));
          }
        }

        if (allPoints.length > 1 && !activeRoute?.googlePath?.length) {
          const bounds = new googleMaps.maps.LatLngBounds();
          allPoints.forEach((point) => bounds.extend(point));
          mapRef.current.fitBounds(bounds);
        }
      } catch (overlayErr) {
        console.warn('Map overlay rendering error caught safely:', overlayErr);
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
    <div className={`relative w-full min-w-0 h-[320px] sm:h-[400px] lg:h-[520px] overflow-hidden bg-slate-100 ${className}`} role="region" aria-label="Google Maps">
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
            <p className="mt-1 text-xs text-slate-500">{error === 'MAPS_API_KEY_MISSING' ? 'Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY to the frontend environment and restart Vite.' : error === 'MAPS_API_AUTH_FAILURE' ? 'Google rejected the Maps key. Check Maps JavaScript API enablement, billing, and website referrer restrictions in Google Cloud Console.' : error === 'MAPS_API_LOAD_TIMEOUT' ? 'Google Maps did not respond in time. Check your network, browser extensions, and API key restrictions, then retry.' : 'Google Maps could not be loaded. Check the browser Console for the Google Maps JavaScript API error.'}</p>
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