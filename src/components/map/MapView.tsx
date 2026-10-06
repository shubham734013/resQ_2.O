import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Minus, Plus, RefreshCw } from 'lucide-react';
import type { MapViewProps } from '../../types/route';
// Leaflet ships as a browser library without bundled TypeScript declarations.
// The package is installed and bundled locally; this keeps runtime loading out of the CDN path.
// @ts-ignore
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type LatLng = [number, number];

const escapeHtml = (value: string): string => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
};

const markerIcon = (label: string, emphasis = false) => ({
  className: 'resq-leaflet-marker',
  html: `<span class="resq-leaflet-marker__dot ${emphasis ? 'resq-leaflet-marker__dot--emergency' : ''}">${escapeHtml(label.slice(0, 12))}</span>`,
  iconSize: [92, 28] as [number, number],
  iconAnchor: [46, 14] as [number, number],
});

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
  const mapRef = useRef<L.Map | null>(null);
  const layerRefs = useRef<L.Layer[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(zoom);

  const fallbackCenter = center ?? (
    userLocation
      ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
      : destination ?? { latitude: 20.5937, longitude: 78.9629 }
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = L.map(containerRef.current, {
        center: [fallbackCenter.latitude, fallbackCenter.longitude],
        zoom,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer(
        (import.meta.env.VITE_OSM_TILE_URL as string | undefined)?.trim()
          || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        },
      ).addTo(map);

      mapRef.current = map;
      setZoomLevel(zoom);
      setStatus('ready');
      setError(null);

      requestAnimationFrame(() => map.invalidateSize());
      window.setTimeout(() => map.invalidateSize(), 150);

      return () => {
        layerRefs.current.forEach((layer) => layer.remove());
        layerRefs.current = [];
        map.remove();
        mapRef.current = null;
      };
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'MAP_INITIALIZATION_FAILED');
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(
      [fallbackCenter.latitude, fallbackCenter.longitude],
      zoomLevel,
    );
  }, [fallbackCenter.latitude, fallbackCenter.longitude, zoomLevel]);

  useEffect(() => {
    if (!mapRef.current || status !== 'ready') return;

    layerRefs.current.forEach((layer) => layer.remove());
    layerRefs.current = [];

    const points: LatLng[] = [];

    if (
      userLocation
      && Number.isFinite(userLocation.latitude)
      && Number.isFinite(userLocation.longitude)
    ) {
      const position: LatLng = [userLocation.latitude, userLocation.longitude];
      const marker = L.marker(position, {
        icon: L.divIcon({
          className: 'resq-leaflet-marker',
          html: '<span class="resq-leaflet-marker__you">You</span>',
          iconSize: [48, 28],
          iconAnchor: [24, 14],
        }),
        title: 'Your current location',
      }).addTo(mapRef.current);

      marker.bindPopup('Your current location');
      layerRefs.current.push(marker);
      points.push(position);
    }

    for (const item of markers) {
      if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;

      const position: LatLng = [item.latitude, item.longitude];
      const marker = L.marker(position, {
        icon: L.divIcon(markerIcon(item.title, Boolean(item.isEmergency))),
        title: item.title,
      }).addTo(mapRef.current);

      const title = escapeHtml(item.title);
      const subtitle = item.subtitle ? `<br/>${escapeHtml(item.subtitle)}` : '';
      marker.bindPopup(`<strong>${title}</strong>${subtitle}`);

      if (item.onClick) marker.on('click', item.onClick);
      layerRefs.current.push(marker);
      points.push(position);
    }

    if (
      destination
      && Number.isFinite(destination.latitude)
      && Number.isFinite(destination.longitude)
    ) {
      const position: LatLng = [destination.latitude, destination.longitude];
      const marker = L.marker(position, {
        icon: L.divIcon(markerIcon(destination.name, Boolean(destination.isEmergency))),
        title: destination.name,
      }).addTo(mapRef.current);

      const name = escapeHtml(destination.name);
      const address = destination.address ? `<br/>${escapeHtml(destination.address)}` : '';
      marker.bindPopup(`<strong>${name}</strong>${address}`);

      layerRefs.current.push(marker);
      points.push(position);
    }

    if (activeRoute?.googlePath?.length) {
      const route = L.polyline(
        activeRoute.googlePath.map((point) => [point.latitude, point.longitude] as LatLng),
        { color: '#2563eb', opacity: 0.95, weight: 6, lineJoin: 'round' },
      ).addTo(mapRef.current);
      layerRefs.current.push(route);
    }

    for (const routeOption of alternativeRoutes) {
      if (!routeOption.googlePath?.length) continue;
      const route = L.polyline(
        routeOption.googlePath.map((point) => [point.latitude, point.longitude] as LatLng),
        { color: '#64748b', opacity: 0.55, weight: 4, lineJoin: 'round' },
      ).addTo(mapRef.current);
      layerRefs.current.push(route);
    }

    if (points.length > 1 && !activeRoute?.googlePath?.length) {
      mapRef.current.fitBounds(points, { padding: [32, 32] });
    }

    requestAnimationFrame(() => mapRef.current?.invalidateSize());
  }, [activeRoute, alternativeRoutes, destination, markers, status, userLocation]);

  const changeZoom = (delta: number) => {
    const next = Math.min(19, Math.max(3, zoomLevel + delta));
    setZoomLevel(next);
    mapRef.current?.setZoom(next);
  };

  const recenter = () => {
    if (!userLocation) {
      onRecenter?.();
      return;
    }

    const nextZoom = 16;
    setZoomLevel(nextZoom);
    mapRef.current?.setView([userLocation.latitude, userLocation.longitude], nextZoom);
    onRecenter?.();
  };

  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-100 ${className}`} role="region" aria-label="OpenStreetMap">
      <div ref={containerRef} className="absolute inset-0" />

      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/90">
          <p className="text-sm font-medium text-slate-600">Loading map…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 p-6">
          <div className="max-w-sm rounded-xl border border-rose-200 bg-white p-5 text-center shadow-sm">
            <p className="font-semibold text-slate-900">Map unavailable</p>
            <p className="mt-1 text-xs text-slate-500">{error || 'The map could not be initialized.'}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
              <RefreshCw className="h-3.5 w-3.5" />Retry
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && interactive && (
        <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
          <button type="button" aria-label="Zoom in" onClick={() => changeZoom(1)} className="rounded-lg bg-white p-2 shadow-md">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => changeZoom(-1)} className="rounded-lg bg-white p-2 shadow-md">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Center on me" onClick={recenter} disabled={!userLocation} className="rounded-lg bg-white p-2 shadow-md disabled:opacity-50">
            <LocateFixed className="h-4 w-4" />
          </button>
        </div>
      )}

      {status === 'ready' && alternativeRoutes.length > 0 && (
        <div className="absolute bottom-3 right-3 z-20 rounded-lg bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow-md">
          {alternativeRoutes.map((route) => (
            <button key={route.id} type="button" onClick={() => onSelectRoute?.(route.id)} className="mr-2 font-semibold text-slate-800 last:mr-0">
              {route.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
