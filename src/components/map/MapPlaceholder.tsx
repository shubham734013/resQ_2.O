import { useState } from 'react';
import {
  Plus,
  Minus,
  LocateFixed,
  Layers,
  Flame,
  Shield,
  Navigation,
} from 'lucide-react';
import type { Facility, UserLocation } from '../../types/facility';
import { IconButton } from '../common/IconButton';

export interface MapPlaceholderProps {
  facilities: Facility[];
  selectedFacility: Facility | null;
  userLocation: UserLocation;
  onSelectFacility: (facility: Facility) => void;
  className?: string;
  onRecenter?: () => void;
}

export const MapPlaceholder = ({
  facilities,
  selectedFacility,
  userLocation,
  onSelectFacility,
  className = '',
  onRecenter,
}: MapPlaceholderProps) => {
  const [zoomLevel, setZoomLevel] = useState(14);
  const [mapStyle, setMapStyle] = useState<'standard' | 'contrast'>('standard');

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 1, 18));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 1, 10));
  const toggleMapStyle = () =>
    setMapStyle((s) => (s === 'standard' ? 'contrast' : 'standard'));

  // Calculate normalized coordinate offset relative to user location for positioning pins on canvas
  const getPinPosition = (lat: number, lng: number) => {
    // Map bounding spread
    const deltaLat = lat - userLocation.latitude;
    const deltaLng = lng - userLocation.longitude;

    // Scale to percentage (center is 50%, 50%)
    const x = 50 + deltaLng * 550;
    const y = 50 - deltaLat * 800;

    // Clamp within 8% to 92% to prevent falling off visible canvas
    return {
      left: `${Math.max(8, Math.min(92, x))}%`,
      top: `${Math.max(12, Math.min(88, y))}%`,
    };
  };

  return (
    <div
      role="application"
      aria-label="Interactive map canvas"
      className={`relative w-full h-full overflow-hidden select-none bg-slate-100 ${
        mapStyle === 'contrast' ? 'bg-slate-200' : 'bg-slate-100'
      } ${className}`}
    >
      {/* Map Vector Grid & Roads Simulation (SVG) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="map-grid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.75"
            />
            <path
              d="M 40 0 L 40 80 M 0 40 L 80 40"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="0.5"
              strokeDasharray="2 2"
            />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#map-grid)" />

        {/* Simulated Arterial Roads / Transit Corridors */}
        <path
          d="M -100 180 Q 200 240, 500 200 T 1200 320"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="3.5"
          opacity="0.5"
        />
        <path
          d="M 220 -50 L 280 800"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="4"
          opacity="0.5"
        />
        <path
          d="M 640 -50 L 600 800"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="3"
          opacity="0.6"
        />
        <path
          d="M -50 480 Q 300 450, 700 500 T 1400 480"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="3"
          opacity="0.6"
        />

        {/* Subtle Waterway / Bay boundary simulation */}
        <path
          d="M 850 -20 Q 920 300, 1100 600 T 1300 900 L 1400 -20 Z"
          fill="#e0f2fe"
          opacity="0.4"
        />
      </svg>

      {/* User Location Radar Marker */}
      <div
        style={{ left: '50%', top: '50%' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center"
      >
        <span className="relative flex h-8 w-8 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-600 border-2 border-white shadow-md"></span>
        </span>
        <span className="text-[10px] font-semibold tracking-wide bg-slate-900/90 text-white px-1.5 py-0.5 rounded shadow-xs -mt-1 backdrop-blur-xs whitespace-nowrap">
          You
        </span>
      </div>

      {/* Facility Map Pins */}
      {facilities.map((fac) => {
        const isSelected = selectedFacility?.id === fac.id;
        const pos = getPinPosition(fac.latitude, fac.longitude);

        return (
          <button
            key={fac.id}
            type="button"
            style={pos}
            onClick={() => onSelectFacility(fac)}
            aria-label={`${fac.name} pin, ${fac.distance}, ${
              fac.emergencyAvailable ? 'Emergency Available' : ''
            }`}
            className={`absolute -translate-x-1/2 -translate-y-full z-30 group cursor-pointer focus-visible:outline-none transition-transform duration-150 ${
              isSelected ? 'scale-110 z-40' : 'hover:scale-105'
            }`}
          >
            <div className="flex flex-col items-center">
              {/* Pin Pill Label */}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold shadow-sm transition-all border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-950 ring-2 ring-slate-900/20'
                    : fac.emergencyAvailable
                    ? 'bg-white text-rose-800 border-rose-200 hover:border-rose-400'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                {fac.emergencyAvailable ? (
                  <Flame
                    className={`w-3 h-3 ${
                      isSelected ? 'text-rose-400' : 'text-rose-600'
                    }`}
                    aria-hidden="true"
                  />
                ) : (
                  <Shield
                    className={`w-3 h-3 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <span className="max-w-[130px] truncate text-[11px] font-medium">
                  {fac.name}
                </span>
                <span className="text-[10px] font-normal opacity-80 pl-0.5">
                  {fac.distance}
                </span>
              </div>

              {/* Pin stem pointer */}
              <div
                className={`w-2.5 h-2.5 rotate-45 -mt-1.5 border-r border-b ${
                  isSelected
                    ? 'bg-slate-900 border-slate-950'
                    : fac.emergencyAvailable
                    ? 'bg-white border-rose-200'
                    : 'bg-white border-slate-200'
                }`}
                aria-hidden="true"
              />
            </div>
          </button>
        );
      })}

      {/* Top Map Controls: Layers / Style */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <IconButton
          icon={<Layers className="w-4 h-4" />}
          size="md"
          variant="default"
          aria-label={`Toggle map layer (${mapStyle === 'standard' ? 'standard' : 'contrast'})`}
          onClick={toggleMapStyle}
        />
      </div>

      {/* Bottom-Right Controls: Recenter, Zoom In, Zoom Out */}
      <div className="absolute bottom-5 right-4 z-20 flex flex-col gap-1.5">
        <IconButton
          icon={<LocateFixed className="w-4 h-4" />}
          size="md"
          variant="default"
          aria-label="Recenter to current location"
          onClick={onRecenter}
        />
        <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in map"
            className="p-2 text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out map"
            className="p-2 text-slate-700 hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Map Status & Scale Bar */}
      <div className="absolute bottom-2 left-4 z-20 flex items-center gap-3 text-[10px] text-slate-500 font-mono pointer-events-none">
        <div className="bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded border border-slate-200/80 shadow-xs flex items-center gap-1.5">
          <Navigation className="w-2.5 h-2.5 text-slate-400 rotate-45" />
          <span>Zoom: {zoomLevel}x</span>
          <span className="text-slate-300">•</span>
          <span>500m scale</span>
        </div>
        <div className="hidden sm:inline-block bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded border border-slate-200/60">
          Google Maps API placeholder
        </div>
      </div>
    </div>
  );
};
