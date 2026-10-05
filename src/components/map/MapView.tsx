import { useState, useMemo } from 'react';
import {
  Plus,
  Minus,
  LocateFixed,
  Layers,
  Flame,
  Building2,
  Navigation,
  Compass,
} from 'lucide-react';
import type { UserLocation } from '../../types/facility';
import type { MapViewProps, RouteCoordinate } from '../../types/route';
import { IconButton } from '../common/IconButton';

const DEFAULT_CENTER = { latitude: 37.7749, longitude: -122.4194 };
const DEFAULT_USER_LOCATION: UserLocation = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 'high',
  label: 'Downtown Financial District, San Francisco',
};

/**
 * Converts an array of RouteCoordinate ({ x, y }) into an SVG path 'd' attribute string.
 */
function coordinatesToSvgPath(points: RouteCoordinate[]): string {
  if (!points || points.length === 0) return '';
  return points.reduce((acc, pt, index) => {
    return index === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');
}

/**
 * ResQ MapView Abstraction
 *
 * Architectural Guarantee:
 * Decouples the frontend application and navigation state from the underlying map provider.
 * When integrating Google Maps API in the future, only the internal JSX rendering of this
 * component will be replaced with GoogleMap, Polyline, and Marker primitives.
 * The external interface (props, callbacks, state) remains 100% identical.
 */
export const MapView = ({
  center = DEFAULT_CENTER,
  zoom = 14,
  userLocation = DEFAULT_USER_LOCATION,
  destination,
  markers = [],
  activeRoute = null,
  alternativeRoutes = [],
  onSelectRoute,
  interactive = true,
  isNavigating = false,
  currentStepIndex = 0,
  onRecenter,
  className = '',
}: MapViewProps) => {
  const [zoomLevel, setZoomLevel] = useState(zoom);
  const [mapStyle, setMapStyle] = useState<'standard' | 'contrast'>('standard');

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 1, 18));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 1, 10));
  const toggleMapStyle = () =>
    setMapStyle((s) => (s === 'standard' ? 'contrast' : 'standard'));

  // Calculate destination percentage position on SVG canvas (viewBox 0 0 100 100)
  const destPos = useMemo(() => {
    if (!destination) return null;
    const deltaLat = destination.latitude - center.latitude;
    const deltaLng = destination.longitude - center.longitude;

    const x = Math.max(12, Math.min(88, 50 + deltaLng * 550));
    const y = Math.max(16, Math.min(84, 50 - deltaLat * 800));

    return { x, y };
  }, [destination, center]);

  // Determine user navigation position along the active route when in navigation mode, or relative to center in preview
  const currentNavUserPos = useMemo(() => {
    if (isNavigating && activeRoute && activeRoute.polylinePoints.length) {
      const points = activeRoute.polylinePoints;
      // Map currentStepIndex smoothly to polyline segment
      const targetIdx = Math.min(currentStepIndex, points.length - 1);
      return points[targetIdx] || { x: 50, y: 50 };
    }

    const deltaLat = userLocation.latitude - center.latitude;
    const deltaLng = userLocation.longitude - center.longitude;
    const x = Math.max(8, Math.min(92, 50 + deltaLng * 550));
    const y = Math.max(12, Math.min(88, 50 - deltaLat * 800));
    return { x, y };
  }, [isNavigating, activeRoute, currentStepIndex, userLocation, center]);

  // Compute SVG path string for active route
  const activeRouteSvgPath = useMemo(() => {
    if (!activeRoute) return '';
    return coordinatesToSvgPath(activeRoute.polylinePoints);
  }, [activeRoute]);

  return (
    <div
      role="region"
      aria-label="Interactive route navigation map"
      className={`relative w-full h-full overflow-hidden select-none bg-slate-100 ${
        mapStyle === 'contrast' ? 'bg-slate-200' : 'bg-slate-100'
      } ${className}`}
    >
      {/* Background Vector Map Canvas (Roads, Grids, and Corridors) */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="nav-map-grid"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 8 0 L 0 0 0 8"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.1"
            />
            <path
              d="M 4 0 L 4 8 M 0 4 L 8 4"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="0.06"
              strokeDasharray="0.3 0.3"
            />
          </pattern>
        </defs>

        {/* Base Grid */}
        <rect width="100%" height="100%" fill="url(#nav-map-grid)" />

        {/* Secondary Arterial Network Roads */}
        <path
          d="M -10 20 Q 30 25, 60 18 T 110 32"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <path
          d="M 25 -10 L 28 110"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="0.7"
          opacity="0.6"
        />
        <path
          d="M 72 -10 L 68 110"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="0.6"
          opacity="0.5"
        />
        <path
          d="M -10 65 Q 35 60, 75 68 T 115 62"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="0.6"
          opacity="0.6"
        />

        {/* Major Transit Corridor */}
        <path
          d="M -5 45 Q 40 40, 80 50 T 105 45"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.2"
          opacity="0.45"
        />
      </svg>

      {/* SVG Polylines Layer for Routes */}
      {(activeRoute || alternativeRoutes.length > 0) && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Alternative Routes (selectable, dashed, muted slate) */}
          {alternativeRoutes.map((alt) => {
            const altPath = coordinatesToSvgPath(alt.polylinePoints);
            return (
              <g
                key={alt.id}
                className="cursor-pointer group"
                onClick={() => onSelectRoute?.(alt.id)}
              >
                {/* Fat transparent hit target for easy clicking / tapping */}
                <path
                  d={altPath}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="6"
                  className="pointer-events-auto"
                />
                {/* Visible dashed alternative route line */}
                <path
                  d={altPath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.4"
                  strokeDasharray="2 1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all group-hover:stroke-slate-600 group-hover:stroke-[1.8]"
                />
              </g>
            );
          })}

          {/* Active Route Outer High-Contrast Glow / Casing */}
          {activeRouteSvgPath && (
            <>
              <path
                d={activeRouteSvgPath}
                fill="none"
                stroke="#bfdbfe"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
              {/* Active Route Main Polyline */}
              <path
                d={activeRouteSvgPath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />
            </>
          )}
        </svg>
      )}

      {/* User Location Radar Marker */}
      <div
        style={{
          left: `${currentNavUserPos.x}%`,
          top: `${currentNavUserPos.y}%`,
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center transition-all duration-500 ease-out"
      >
        {isNavigating ? (
          // In Navigation Mode: Directional Heading Puck
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-40" />
            <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white">
              <Navigation className="w-4 h-4 fill-white text-white -rotate-45" />
            </div>
            <span className="absolute -bottom-5 text-[9px] font-bold tracking-wide bg-slate-950/90 text-white px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap">
              Navigating
            </span>
          </div>
        ) : (
          // In Preview Mode: Pulsing Radar Beacon
          <div className="flex flex-col items-center">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-600 border-2 border-white shadow-md" />
            </span>
            <span className="text-[10px] font-semibold tracking-wide bg-slate-900/90 text-white px-1.5 py-0.5 rounded shadow-xs -mt-1 backdrop-blur-xs whitespace-nowrap">
              You
            </span>
          </div>
        )}
      </div>

      {/* Destination Pin */}
      {destination && destPos && (
        <div
          style={{
            left: `${destPos.x}%`,
            top: `${destPos.y}%`,
          }}
          className="absolute -translate-x-1/2 -translate-y-full z-30 flex flex-col items-center pointer-events-auto"
        >
          {/* Destination Tooltip Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold shadow-md border ${
              destination.isEmergency
                ? 'bg-rose-900 text-white border-rose-950 ring-2 ring-rose-500/20'
                : 'bg-slate-900 text-white border-slate-950 ring-2 ring-slate-900/20'
            }`}
          >
            {destination.isEmergency ? (
              <Flame className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
            ) : (
              <Building2 className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            )}
            <span className="max-w-[140px] truncate">{destination.name}</span>
            {activeRoute && (
              <span className="text-[10px] opacity-80 border-l border-white/20 pl-1.5 font-mono">
                {activeRoute.duration}
              </span>
            )}
          </div>
          {/* Stem pointer */}
          <div
            className={`w-2.5 h-2.5 rotate-45 -mt-1 border-r border-b ${
              destination.isEmergency
                ? 'bg-rose-900 border-rose-950'
                : 'bg-slate-900 border-slate-950'
            }`}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Additional Markers (e.g. nearby facilities if present) */}
      {markers.map((marker) => {
        const deltaLat = marker.latitude - center.latitude;
        const deltaLng = marker.longitude - center.longitude;
        const x = Math.max(8, Math.min(92, 50 + deltaLng * 550));
        const y = Math.max(12, Math.min(88, 50 - deltaLat * 800));

        return (
          <button
            key={marker.id}
            type="button"
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={marker.onClick}
            aria-label={`${marker.title} marker`}
            className="absolute -translate-x-1/2 -translate-y-full z-20 group cursor-pointer focus-visible:outline-none"
          >
            <div className="flex flex-col items-center">
              <div className="bg-white/95 border border-slate-200 text-slate-800 text-[10px] font-medium px-1.5 py-0.5 rounded shadow-xs group-hover:border-slate-400">
                {marker.title}
              </div>
              <div className="w-2 h-2 bg-white rotate-45 -mt-1 border-r border-b border-slate-200" />
            </div>
          </button>
        );
      })}

      {/* Map Control Buttons: Top Right (Layers & Recenter) */}
      {interactive && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          <IconButton
            icon={<Layers className="w-4 h-4" />}
            size="md"
            variant="default"
            aria-label={`Toggle map layer (${mapStyle === 'standard' ? 'standard' : 'contrast'})`}
            onClick={toggleMapStyle}
          />
          {isNavigating && (
            <div className="p-2 bg-white/90 backdrop-blur-xs rounded-lg border border-slate-200 text-slate-700 shadow-xs flex items-center justify-center">
              <Compass className="w-4 h-4 text-slate-500 animate-pulse" />
            </div>
          )}
        </div>
      )}

      {/* Map Control Buttons: Bottom Right (Recenter, Zoom In/Out) */}
      {interactive && (
        <div className="absolute bottom-5 right-4 z-20 flex flex-col gap-1.5">
          <IconButton
            icon={<LocateFixed className="w-4 h-4" />}
            size="md"
            variant="default"
            aria-label="Recenter map to user location"
            onClick={onRecenter}
          />
          <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Zoom in"
              className="p-2 text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Zoom out"
              className="p-2 text-slate-700 hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Map Telemetry Scale & Attribution */}
      <div className="absolute bottom-2 left-4 z-20 flex items-center gap-2.5 text-[10px] text-slate-500 font-mono pointer-events-none">
        <div className="bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded border border-slate-200/80 shadow-xs flex items-center gap-1.5">
          <Navigation className="w-2.5 h-2.5 text-slate-400 rotate-45" />
          <span>Zoom: {zoomLevel}x</span>
          <span className="text-slate-300">•</span>
          <span>ResQ Navigation Abstraction</span>
        </div>
      </div>
    </div>
  );
};
