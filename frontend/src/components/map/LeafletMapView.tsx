import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { MapViewProps } from '../../types/route';
import { DEFAULT_JAIPUR_COORDINATES } from '../../types/maps';

const isValidCoordinate = (c?: { latitude?: number | null; longitude?: number | null } | null): c is { latitude: number; longitude: number } =>
  Boolean(
    c &&
    typeof c.latitude === 'number' &&
    typeof c.longitude === 'number' &&
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude) &&
    (c.latitude !== 0 || c.longitude !== 0)
  );

export const LeafletMapView = ({
  center,
  zoom = 13,
  userLocation,
  destination,
  markers = [],
  activeRoute,
  alternativeRoutes = [],
  onSelectRoute,
  interactive = true,
  isNavigating = false,
  className = '',
}: MapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const fallbackCenter = (isValidCoordinate(center) ? center : undefined)
    ?? (isValidCoordinate(userLocation) ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : undefined)
    ?? (isValidCoordinate(destination) ? { latitude: destination.latitude, longitude: destination.longitude } : undefined)
    ?? DEFAULT_JAIPUR_COORDINATES;

  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet Map instance
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [fallbackCenter.latitude, fallbackCenter.longitude],
        zoom,
        zoomControl: false,
        attributionControl: false,
      });

      // CartoDB Dark Matter tile layer
      const darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      });

      // Fallback OpenStreetMap standard tile layer
      darkTileLayer.on('tileerror', () => {
        darkTileLayer.setUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
      });

      darkTileLayer.addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      mapRef.current = map;
      setMapReady(true);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
        routeLayerRef.current = null;
      }
    };
  }, []);

  // Update center when center prop changes
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.setView([fallbackCenter.latitude, fallbackCenter.longitude], mapRef.current.getZoom(), { animate: true });
  }, [fallbackCenter.latitude, fallbackCenter.longitude, mapReady]);

  // Recenter helper
  const recenter = useCallback(() => {
    if (!mapRef.current) return;
    const target = isValidCoordinate(userLocation) ? userLocation : fallbackCenter;
    mapRef.current.setView([target.latitude, target.longitude], 15, { animate: true });
  }, [userLocation, fallbackCenter]);

  // Zoom control helpers
  const changeZoom = useCallback((delta: number) => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(mapRef.current.getZoom() + delta);
  }, []);

  // Render Markers and Polylines
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !markersLayer || !routeLayer || !mapReady) return;

    markersLayer.clearLayers();
    routeLayer.clearLayers();

    const bounds = L.latLngBounds([]);

    // 1. User Location Marker (Pulsing Blue Ring)
    if (isValidCoordinate(userLocation)) {
      const userLatLng = L.latLng(userLocation.latitude, userLocation.longitude);
      bounds.extend(userLatLng);

      const userIcon = L.divIcon({
        className: 'custom-user-leaflet-icon',
        html: `
          <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
            <span style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background: rgba(59, 130, 246, 0.25); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
            <span style="position: absolute; width: 24px; height: 24px; border-radius: 9999px; background: rgba(96, 165, 250, 0.3); border: 1px solid rgba(96, 165, 250, 0.5);"></span>
            <div style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background: #2563eb; border: 2px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker(userLatLng, { icon: userIcon, title: 'Your Location' }).addTo(markersLayer);
    }

    // 2. Map Markers (Ambulances, Hospitals, Default)
    for (const item of markers) {
      if (isValidCoordinate(item)) {
        const itemLatLng = L.latLng(item.latitude, item.longitude);
        bounds.extend(itemLatLng);

        const isAmb = item.type === 'AMBULANCE' || item.id === 'me' || item.title.toLowerCase().includes('ambulance') || item.title.toLowerCase().includes('rj-');
        const isHosp = item.type === 'HOSPITAL' || item.title.toLowerCase().includes('hospital') || item.title.toLowerCase().includes('clinic');

        let markerHtml = '';
        if (isAmb) {
          markerHtml = `
            <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer;">
              <div style="background: rgba(9, 9, 11, 0.95); color: #ffffff; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; border: 1px solid rgba(244, 63, 94, 0.4); box-shadow: 0 4px 10px rgba(0,0,0,0.5); white-space: nowrap; margin-bottom: 2px;">
                🚨 ${item.title || 'Ambulance'}
              </div>
              <div style="width: 34px; height: 34px; border-radius: 12px; background: linear-gradient(135deg, #e11d48, #f43f5e); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 8px 16px rgba(225, 29, 72, 0.5);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 17h4V5H2v12h3m9 0h4l3 3v-7h-7v4z"/>
                  <circle cx="7" cy="17" r="2"/>
                  <circle cx="17" cy="17" r="2"/>
                </svg>
              </div>
              <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #e11d48; margin-top: -1px;"></div>
            </div>
          `;
        } else if (isHosp) {
          markerHtml = `
            <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer;">
              <div style="background: rgba(9, 9, 11, 0.95); color: #ffffff; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.4); box-shadow: 0 4px 10px rgba(0,0,0,0.5); white-space: nowrap; margin-bottom: 2px;">
                🏥 ${item.title}
              </div>
              <div style="width: 32px; height: 32px; border-radius: 12px; background: linear-gradient(135deg, #059669, #10b981); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.5);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 4v16m-8-8h16"/>
                </svg>
              </div>
              <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #059669; margin-top: -1px;"></div>
            </div>
          `;
        } else {
          markerHtml = `
            <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer;">
              <div style="background: rgba(9, 9, 11, 0.9); color: #ffffff; padding: 2px 6px; border-radius: 9999px; font-size: 10px; font-weight: 600; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap; margin-bottom: 2px;">
                📍 ${item.title}
              </div>
              <div style="width: 24px; height: 24px; border-radius: 9999px; background: #e11d48; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff;">
                <div style="width: 6px; height: 6px; border-radius: 9999px; background: white;"></div>
              </div>
            </div>
          `;
        }

        const icon = L.divIcon({
          className: 'custom-marker-leaflet-icon',
          html: markerHtml,
          iconSize: [36, 48],
          iconAnchor: [18, 48],
        });

        const m = L.marker(itemLatLng, { icon, title: item.title });
        if (item.onClick) {
          m.on('click', item.onClick);
        }
        m.addTo(markersLayer);
      }
    }

    // 3. Destination Marker
    if (isValidCoordinate(destination)) {
      const destLatLng = L.latLng(destination.latitude, destination.longitude);
      bounds.extend(destLatLng);

      const destIcon = L.divIcon({
        className: 'custom-dest-leaflet-icon',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer;">
            <div style="background: rgba(9, 9, 11, 0.95); color: #ffffff; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.4); box-shadow: 0 4px 10px rgba(0,0,0,0.5); white-space: nowrap; margin-bottom: 2px;">
              🏥 ${destination.name}
            </div>
            <div style="width: 32px; height: 32px; border-radius: 12px; background: linear-gradient(135deg, #059669, #10b981); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.5);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4v16m-8-8h16"/>
              </svg>
            </div>
            <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #059669; margin-top: -1px;"></div>
          </div>
        `,
        iconSize: [36, 48],
        iconAnchor: [18, 48],
      });

      L.marker(destLatLng, { icon: destIcon, title: destination.name }).addTo(markersLayer);
    }

    // 4. Primary Active Route Polyline
    if (activeRoute?.googlePath && activeRoute.googlePath.length > 0) {
      const latLngs = activeRoute.googlePath
        .filter((p) => isValidCoordinate(p))
        .map((p) => L.latLng(p.latitude, p.longitude));

      if (latLngs.length > 0) {
        latLngs.forEach((p) => bounds.extend(p));

        // Layer 1: Aura
        L.polyline(latLngs, {
          color: 'rgba(244, 63, 94, 0.35)',
          weight: 10,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeLayer);

        // Layer 2: Core Crimson Emergency Route
        L.polyline(latLngs, {
          color: '#f43f5e',
          weight: 4,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeLayer);
      }
    } else if (isValidCoordinate(userLocation) && isValidCoordinate(destination)) {
      // Fallback straight-line emergency path if no intermediate polyline
      const direct = [
        L.latLng(userLocation.latitude, userLocation.longitude),
        L.latLng(destination.latitude, destination.longitude),
      ];
      L.polyline(direct, {
        color: '#f43f5e',
        weight: 3,
        opacity: 0.85,
        dashArray: '8, 8',
      }).addTo(routeLayer);
    }

    // 5. Alternative Routes
    for (const alt of alternativeRoutes) {
      if (alt.googlePath && alt.googlePath.length > 0) {
        const altPoints = alt.googlePath
          .filter((p) => isValidCoordinate(p))
          .map((p) => L.latLng(p.latitude, p.longitude));
        if (altPoints.length > 0) {
          L.polyline(altPoints, {
            color: '#38bdf8',
            weight: 3,
            opacity: 0.7,
            dashArray: '6, 6',
          }).addTo(routeLayer);
        }
      }
    }

    // Auto-fit bounds if multiple points exist
    if (bounds.isValid() && bounds.getNorthEast() && !isNavigating) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [markers, userLocation, destination, activeRoute, alternativeRoutes, mapReady, isNavigating]);

  return (
    <div className={`relative w-full h-full min-h-[300px] overflow-hidden bg-[#070709] select-none ${className}`}>
      {/* Leaflet container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Real-time map provider badge */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-xl bg-zinc-950/85 backdrop-blur-md px-3 py-1.5 border border-white/10 shadow-lg text-[11px] text-zinc-300">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-semibold text-white">Live OSM Map</span>
        <span className="text-[9px] text-zinc-400 font-mono">Jaipur Emergency Grid</span>
      </div>

      {/* Map Control Buttons */}
      {interactive && (
        <div className="absolute right-3.5 top-3.5 z-20 flex flex-col gap-2">
          {/* Recenter */}
          <button
            type="button"
            aria-label="Move map to my location"
            onClick={recenter}
            className="rounded-2xl bg-zinc-950/85 hover:bg-zinc-900 text-zinc-200 p-2.5 shadow-xl border border-white/10 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
            title="Show my location"
          >
            <LocateFixed className="h-4 w-4 text-rose-500" />
          </button>

          {/* Zoom In & Out */}
          <div className="flex flex-col rounded-2xl bg-zinc-950/85 shadow-xl border border-white/10 backdrop-blur-md overflow-hidden divide-y divide-white/10">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => changeZoom(1)}
              className="p-2.5 hover:bg-white/[0.08] text-zinc-300 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => changeZoom(-1)}
              className="p-2.5 hover:bg-white/[0.08] text-zinc-300 transition-colors cursor-pointer"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Alternative Routes Selector */}
      {alternativeRoutes.length > 0 && !isNavigating && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-2xl bg-zinc-950/90 backdrop-blur-md px-3.5 py-2 shadow-2xl border border-white/10 text-xs text-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Routes:</span>
          {activeRoute && (
            <span className="font-bold text-rose-300 px-2.5 py-0.5 rounded-lg bg-rose-500/20 border border-rose-500/30">
              {activeRoute.name || 'Fastest'} ({activeRoute.duration})
            </span>
          )}
          {alternativeRoutes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelectRoute?.(route.id)}
              className="font-medium text-zinc-300 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/[0.06] transition cursor-pointer"
            >
              {route.name} ({route.duration})
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
