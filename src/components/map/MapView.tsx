import { useEffect, useRef, useState, useCallback } from 'react';
import { LocateFixed, Minus, Plus, RefreshCw, Layers, Compass } from 'lucide-react';
import type { MapViewProps } from '../../types/route';
import type { GoogleMapInstance, GoogleMarkerOverlay, GooglePolyline, GoogleTrafficLayer } from '../../types/googleMaps';
import { loadGoogleMaps } from '../../services/googleMapsLoader';

interface AdvancedMarkerConstructor {
  new (options: { map: GoogleMapInstance; position: { lat: number; lng: number }; title?: string; content?: HTMLElement; gmpClickable?: boolean }): GoogleMarkerOverlay;
}

interface MapLibrary {
  Map: new (element: HTMLElement, options: { center: { lat: number; lng: number }; zoom: number; mapId?: string; streetViewControl?: boolean; mapTypeControl?: boolean; fullscreenControl?: boolean; clickableIcons?: boolean; heading?: number; tilt?: number }) => GoogleMapInstance;
  LatLngBounds: new () => { extend(point: { lat: number; lng: number }): void };
  Polyline: new (options: { map?: GoogleMapInstance; path: { lat: number; lng: number }[]; strokeColor?: string; strokeOpacity?: number; strokeWeight?: number; zIndex?: number }) => GooglePolyline;
  TrafficLayer?: new () => GoogleTrafficLayer;
}

const toGoogle = (latitude: number, longitude: number) => ({ lat: latitude, lng: longitude });

const escapeHtml = (str: string): string => {
  return str.replace(/[&<>'"]/g, (tag) => {
    const chars: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return chars[tag] || tag;
  });
};

const createUserMarkerElement = (): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none';
  container.innerHTML = `
    <span class="absolute h-9 w-9 rounded-full bg-blue-500/25 animate-ping"></span>
    <span class="absolute h-7 w-7 rounded-full bg-blue-400/20 border border-blue-400/40"></span>
    <div class="relative h-4.5 w-4.5 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center">
      <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
    </div>
  `;
  return container;
};

const createAmbulanceMarkerElement = (title: string, subtitle?: string): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'relative flex flex-col items-center -translate-x-1/2 -translate-y-full cursor-pointer select-none transition-transform duration-300 hover:scale-110';
  container.innerHTML = `
    <div class="mb-1 px-2.5 py-0.5 rounded-full bg-slate-950/95 text-white text-[10px] font-bold shadow-lg border border-slate-700/80 flex items-center gap-1.5 whitespace-nowrap">
      <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span>${escapeHtml(title || 'Ambulance')}</span>
      ${subtitle ? `<span class="text-[9px] text-slate-300 font-normal">· ${escapeHtml(subtitle)}</span>` : ''}
    </div>
    <div class="relative h-10 w-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 text-white shadow-xl border-2 border-white flex items-center justify-center">
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 17h4V5H2v12h3m9 0h4l3 3v-7h-7v4z"/>
        <circle cx="7" cy="17" r="2"/>
        <circle cx="17" cy="17" r="2"/>
      </svg>
      <span class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-500 border border-white animate-ping"></span>
    </div>
    <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-rose-600 -mt-0.5"></div>
  `;
  return container;
};

const createHospitalMarkerElement = (name: string, isEmergency = true): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'relative flex flex-col items-center -translate-x-1/2 -translate-y-full cursor-pointer select-none transition-transform duration-300 hover:scale-105';
  container.innerHTML = `
    <div class="mb-1 px-2.5 py-1 rounded-xl bg-slate-950/95 text-white text-[11px] font-bold shadow-xl border border-slate-800 flex items-center gap-1.5 whitespace-nowrap">
      <span class="h-2 w-2 rounded-full ${isEmergency ? 'bg-rose-500 animate-pulse' : 'bg-blue-500'}"></span>
      <span class="max-w-[130px] truncate">${escapeHtml(name)}</span>
      <span class="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1 py-0.5 rounded">24/7 ER</span>
    </div>
    <div class="relative h-9 w-9 rounded-2xl ${isEmergency ? 'bg-gradient-to-b from-rose-500 to-rose-700' : 'bg-gradient-to-b from-blue-600 to-indigo-700'} text-white shadow-2xl border-2 border-white flex items-center justify-center">
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 4v16m-8-8h16"/>
      </svg>
    </div>
    <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] ${isEmergency ? 'border-t-rose-700' : 'border-t-indigo-700'} -mt-0.5"></div>
  `;
  return container;
};

const createDefaultMarkerElement = (title: string, subtitle?: string, isEmergency = false): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'relative flex flex-col items-center -translate-x-1/2 -translate-y-full cursor-pointer select-none transition-transform duration-200 hover:scale-105';
  container.innerHTML = `
    <div class="mb-1 px-2 py-0.5 rounded-full ${isEmergency ? 'bg-rose-950 text-rose-100 border-rose-800' : 'bg-slate-900 text-white border-slate-700'} text-[10px] font-bold shadow-md border flex items-center gap-1 whitespace-nowrap">
      <span>${escapeHtml(title)}</span>
      ${subtitle ? `<span class="text-[9px] text-slate-300 font-normal">· ${escapeHtml(subtitle)}</span>` : ''}
    </div>
    <div class="h-7 w-7 rounded-full ${isEmergency ? 'bg-rose-600' : 'bg-slate-800'} text-white shadow-lg border-2 border-white flex items-center justify-center">
      <div class="h-2 w-2 rounded-full bg-white"></div>
    </div>
    <div class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] ${isEmergency ? 'border-t-rose-600' : 'border-t-slate-800'} -mt-0.5"></div>
  `;
  return container;
};

const createOverlayMarker = (
  googleMaps: any,
  map: GoogleMapInstance,
  position: { lat: number; lng: number },
  content: HTMLElement,
  onClick?: () => void
): GoogleMarkerOverlay | null => {
  const OverlayConstructor = googleMaps?.maps?.OverlayView;
  if (!OverlayConstructor) {
    const MarkerConstructor = googleMaps?.maps?.Marker;
    if (MarkerConstructor) {
      const marker = new MarkerConstructor({
        map,
        position,
        title: content.textContent || '',
      });
      if (onClick && marker.addListener) marker.addListener('click', onClick);
      return marker;
    }
    return null;
  }

  const overlay = new OverlayConstructor();
  const el = content;

  if (onClick) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      onClick();
    });
  }

  overlay.onAdd = function () {
    const panes = this.getPanes?.();
    if (panes?.overlayMouseTarget) {
      panes.overlayMouseTarget.appendChild(el);
      el.style.position = 'absolute';
      el.style.zIndex = '35';
    }
  };

  overlay.draw = function () {
    const projection = this.getProjection?.();
    if (!projection) return;
    const gMaps = (window as unknown as { google?: { maps: { LatLng: new (lat: number, lng: number) => unknown } } })?.google?.maps;
    const latLng = gMaps?.LatLng ? new gMaps.LatLng(position.lat, position.lng) : position;
    const point = projection.fromLatLngToDivPixel(latLng);
    if (point) {
      el.style.left = `${Math.round(point.x)}px`;
      el.style.top = `${Math.round(point.y)}px`;
    }
  };

  overlay.onRemove = function () {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  };

  overlay.setMap(map);
  return overlay;
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
  isNavigating = false,
  currentStepIndex = 0,
  onRecenter,
  recenterTrigger = 0,
  className = '',
}: MapViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMarkerOverlay[]>([]);
  const polylinesRef = useRef<GooglePolyline[]>([]);
  const trafficLayerRef = useRef<GoogleTrafficLayer | null>(null);

  const rawMapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined)?.trim();
  const hasValidMapId = Boolean(rawMapId && rawMapId !== 'DEMO_MAP_ID' && !rawMapId.startsWith('DEMO_'));
  const validMapId = hasValidMapId ? rawMapId : undefined;

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(zoom);
  const [showTraffic, setShowTraffic] = useState(false);
  const [is3D, setIs3D] = useState(false);

  const fallbackCenter = center ?? (userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : destination ?? { latitude: 26.8500, longitude: 75.8000 });

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      if (!containerRef.current) return;
      try {
        setStatus('loading');
        const googleMaps = await loadGoogleMaps();
        if (cancelled || !containerRef.current) return;
        const maps = await googleMaps.maps.importLibrary('maps') as unknown as MapLibrary;
        mapRef.current = new maps.Map(containerRef.current, {
          center: toGoogle(fallbackCenter.latitude, fallbackCenter.longitude),
          zoom,
          ...(validMapId ? { mapId: validMapId } : {}),
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          tilt: isNavigating || is3D ? 45 : 0,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || status !== 'ready') return;
    mapRef.current.setCenter(toGoogle(fallbackCenter.latitude, fallbackCenter.longitude));
  }, [fallbackCenter.latitude, fallbackCenter.longitude, status]);

  // Traffic Layer Toggle
  useEffect(() => {
    if (!mapRef.current || status !== 'ready') return;
    const applyTraffic = async () => {
      try {
        const googleMaps = await loadGoogleMaps();
        if (showTraffic) {
          if (!trafficLayerRef.current && googleMaps.maps.TrafficLayer) {
            trafficLayerRef.current = new googleMaps.maps.TrafficLayer();
          }
          trafficLayerRef.current?.setMap(mapRef.current);
        } else {
          trafficLayerRef.current?.setMap(null);
        }
      } catch {
        // Traffic layer best effort
      }
    };
    void applyTraffic();
  }, [showTraffic, status]);

  // 3D Perspective Tilt Toggle
  const toggle3D = useCallback(() => {
    if (!mapRef.current) return;
    const next = !is3D;
    setIs3D(next);
    if (mapRef.current.setTilt) {
      mapRef.current.setTilt(next ? 45 : 0);
    }
  }, [is3D]);

  // Desktop/Mobile Resize Observer
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

  // Render Markers and Uber-Styled Route Polylines
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
          try {
            if (typeof marker.setMap === 'function') {
              marker.setMap(null);
            } else {
              marker.map = null;
            }
          } catch { /* ignore */ }
        });
        markersRef.current = [];
        polylinesRef.current.forEach((line) => {
          try { line.setMap(null); } catch { /* ignore */ }
        });
        polylinesRef.current = [];

        const allPoints: Array<{ lat: number; lng: number }> = [];

        const addMarker = (lat: number, lng: number, title: string, content: HTMLElement, onClick?: () => void) => {
          if (!mapRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const pos = toGoogle(lat, lng);
          allPoints.push(pos);

          let createdMarker: GoogleMarkerOverlay | null = null;

          if (validMapId && AdvancedMarkerElement) {
            try {
              const adv = new AdvancedMarkerElement({
                map: mapRef.current,
                position: pos,
                title,
                content,
                gmpClickable: Boolean(onClick),
              });
              if (onClick && adv.addListener) adv.addListener('click', onClick);
              createdMarker = adv;
            } catch {
              // AdvancedMarkerElement failed on map; fallback seamlessly to OverlayView
            }
          }

          if (!createdMarker) {
            try {
              createdMarker = createOverlayMarker(googleMaps, mapRef.current, pos, content, onClick);
            } catch {
              // Best-effort overlay fallback
            }
          }

          if (createdMarker) {
            markersRef.current.push(createdMarker);
          }
        };

        // 1. User Location Beacon (Uber User Dot with live pulse)
        if (userLocation && Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude)) {
          addMarker(userLocation.latitude, userLocation.longitude, 'Your Location', createUserMarkerElement());
        }

        // 2. Specific Markers (Ambulance, Hospital, Pickups)
        for (const item of markers) {
          if (Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) {
            const isAmb = item.type === 'AMBULANCE' || item.id === 'ambulance' || item.title.toLowerCase().includes('ambulance');
            const isHosp = item.type === 'HOSPITAL' || item.id === 'hospital' || item.title.toLowerCase().includes('hospital');

            let el: HTMLElement;
            if (isAmb) {
              const sub = item.subtitle || item.metadata?.subtitle || item.metadata?.vehiclePlate || item.metadata?.badgeText;
              el = createAmbulanceMarkerElement(item.title, sub);
            } else if (isHosp) {
              el = createHospitalMarkerElement(item.title, item.isEmergency ?? true);
            } else {
              el = createDefaultMarkerElement(item.title, item.subtitle, item.isEmergency ?? false);
            }
            addMarker(item.latitude, item.longitude, item.title, el, item.onClick);
          }
        }

        // 3. Destination Hospital Marker
        if (destination && Number.isFinite(destination.latitude) && Number.isFinite(destination.longitude)) {
          const isHosp = destination.name.toLowerCase().includes('hospital') || destination.name.toLowerCase().includes('clinic') || destination.name.toLowerCase().includes('medical');
          const el = isHosp
            ? createHospitalMarkerElement(destination.name, destination.isEmergency ?? true)
            : createDefaultMarkerElement(destination.name, destination.address, destination.isEmergency ?? false);
          addMarker(destination.latitude, destination.longitude, destination.name, el);
        }

        // 4. Primary Active Route (Uber-Style layered casing + vibrant polyline)
        if (activeRoute?.googlePath?.length) {
          const path = activeRoute.googlePath
            .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
            .map((point) => toGoogle(point.latitude, point.longitude));

          if (path.length) {
            // Layer 1: Dark Casing / Road Shadow Underneath
            polylinesRef.current.push(new googleMaps.maps.Polyline({
              map: mapRef.current,
              path,
              strokeColor: '#0f172a',
              strokeOpacity: 0.35,
              strokeWeight: 10,
              zIndex: 10,
            }));

            // Layer 2: Core Electric Blue Route Line
            polylinesRef.current.push(new googleMaps.maps.Polyline({
              map: mapRef.current,
              path,
              strokeColor: '#2563eb',
              strokeOpacity: 0.95,
              strokeWeight: 6,
              zIndex: 11,
            }));
          }
        }

        // 5. Alternative Routes
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
              strokeOpacity: 0.5,
              strokeWeight: 4,
              zIndex: 5,
            }));
          }
        }

        // 6. Camera Fitting and Navigation Panning
        if (activeRoute?.googlePath?.length && !isNavigating) {
          const bounds = new googleMaps.maps.LatLngBounds();
          activeRoute.googlePath.forEach((point) => {
            if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
              bounds.extend(toGoogle(point.latitude, point.longitude));
            }
          });
          allPoints.forEach((point) => bounds.extend(point));
          mapRef.current.fitBounds(bounds);
        } else if (allPoints.length > 1 && !isNavigating) {
          const bounds = new googleMaps.maps.LatLngBounds();
          allPoints.forEach((point) => bounds.extend(point));
          mapRef.current.fitBounds(bounds);
        } else if (isNavigating) {
          const targetCoords = userLocation
            ? toGoogle(userLocation.latitude, userLocation.longitude)
            : destination
            ? toGoogle(destination.latitude, destination.longitude)
            : null;

          if (targetCoords) {
            if (mapRef.current.panTo) {
              mapRef.current.panTo(targetCoords);
            } else {
              mapRef.current.setCenter(targetCoords);
            }
            mapRef.current.setZoom(17);
            if (mapRef.current.setTilt) {
              mapRef.current.setTilt(45);
            }
          }
        }
      } catch (overlayErr) {
        console.warn('Map overlay rendering error caught safely:', overlayErr);
      }
    };
    void renderOverlays();
    return () => { cancelled = true; };
  }, [activeRoute, alternativeRoutes, currentStepIndex, destination, isNavigating, markers, status, userLocation]);

  useEffect(() => {
    if (recenterTrigger && mapRef.current && status === 'ready') {
      recenter();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterTrigger]);

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
    const coords = toGoogle(userLocation.latitude, userLocation.longitude);
    if (mapRef.current?.panTo) {
      mapRef.current.panTo(coords);
    } else {
      mapRef.current?.setCenter(coords);
    }
    mapRef.current?.setZoom(17);
    setZoomLevel(17);
    onRecenter?.();
  };

  return (
    <div className={`relative w-full min-w-0 h-[320px] sm:h-[400px] lg:h-[520px] overflow-hidden bg-slate-950 ${className}`} role="region" aria-label="Google Maps">
      <div ref={containerRef} className="absolute inset-0" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="h-7 w-7 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-200">Initializing Navigation Map…</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-900/90 z-10">
          <div className="max-w-sm rounded-2xl border border-rose-800 bg-slate-950 p-5 shadow-2xl text-center">
            <p className="font-bold text-white text-sm">Navigation Map Unavailable</p>
            <p className="mt-1 text-xs text-slate-400">{error === 'MAPS_API_KEY_MISSING' ? 'Google Maps key is missing in environment.' : 'Google Maps could not be initialized. Check internet connection and retry.'}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-bold text-white transition"><RefreshCw className="h-3.5 w-3.5" /> Retry Map</button>
          </div>
        </div>
      )}

      {status === 'ready' && interactive && (
        <div className="absolute right-3.5 top-3.5 z-20 flex flex-col gap-2">
          {/* Re-center / Locate */}
          <button
            type="button"
            aria-label="Center on my location"
            onClick={recenter}
            disabled={!userLocation}
            className="rounded-2xl bg-white/95 hover:bg-white text-slate-800 p-2.5 shadow-xl border border-slate-200/80 backdrop-blur-md transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
            title="Recenter"
          >
            <LocateFixed className="h-4 w-4 text-blue-600" />
          </button>

          {/* 3D / 2D Perspective Toggle */}
          <button
            type="button"
            aria-label="Toggle 3D View"
            onClick={toggle3D}
            className={`rounded-2xl p-2.5 shadow-xl border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
              is3D
                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30'
                : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/80'
            }`}
            title={is3D ? 'Switch to 2D' : 'Switch to 3D Perspective'}
          >
            <Compass className="h-4 w-4" />
          </button>

          {/* Live Traffic Layer Toggle */}
          <button
            type="button"
            aria-label="Toggle Live Traffic"
            onClick={() => setShowTraffic((prev) => !prev)}
            className={`rounded-2xl p-2.5 shadow-xl border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
              showTraffic
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/30'
                : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200/80'
            }`}
            title={showTraffic ? 'Hide Traffic' : 'Show Live Traffic'}
          >
            <Layers className="h-4 w-4" />
          </button>

          {/* Zoom In & Out Group */}
          <div className="flex flex-col rounded-2xl bg-white/95 shadow-xl border border-slate-200/80 backdrop-blur-md overflow-hidden">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => changeZoom(1)}
              className="p-2.5 hover:bg-slate-100 text-slate-800 border-b border-slate-100 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => changeZoom(-1)}
              className="p-2.5 hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Alternative Routes Selector (Uber-Style Floating Bar) */}
      {status === 'ready' && alternativeRoutes.length > 0 && !isNavigating && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-2xl bg-slate-950/90 backdrop-blur-md px-3.5 py-2 shadow-2xl border border-slate-800 text-xs text-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Routes:</span>
          {activeRoute && (
            <span className="font-bold text-blue-400 px-2 py-0.5 rounded-lg bg-blue-950/80 border border-blue-800/80">
              {activeRoute.name || 'Fastest'} ({activeRoute.duration})
            </span>
          )}
          {alternativeRoutes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelectRoute?.(route.id)}
              className="font-medium text-slate-300 hover:text-white px-2 py-0.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              {route.name} ({route.duration})
            </button>
          ))}
        </div>
      )}
    </div>
  );
};