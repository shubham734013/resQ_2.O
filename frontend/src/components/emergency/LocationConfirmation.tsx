import { useState } from 'react';
import { MapPin, ArrowRight, RefreshCw, Edit3, AlertCircle } from 'lucide-react';
import type { UserLocation } from '../../types/facility';
import { mapsApi } from '../../services/mapsApi';
import { MapView } from '../map/MapView';
import { darkMapStyle } from '../map/darkMapStyle';

export interface LocationConfirmationProps {
  currentLocation: UserLocation;
  onConfirmLocation: (location: UserLocation) => void;
  onBack?: () => void;
  isLocationUnavailable?: boolean;
  onRetryLocation?: () => void;
  className?: string;
}

export const LocationConfirmation = ({
  currentLocation,
  onConfirmLocation,
  onBack,
  isLocationUnavailable = false,
  onRetryLocation,
  className = '',
}: LocationConfirmationProps) => {
  const [customLocation, setCustomLocation] = useState<UserLocation | null>(null);
  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const selectedLocation = customLocation ?? currentLocation;
  const valid =
    Number.isFinite(selectedLocation.latitude) &&
    Number.isFinite(selectedLocation.longitude) &&
    (selectedLocation.latitude !== 0 || selectedLocation.longitude !== 0);

  const applyAddress = async () => {
    if (!customInput.trim()) return;
    setIsGeocoding(true);
    setGeocodeError(null);
    try {
      const place = await mapsApi.geocode(customInput.trim());
      setCustomLocation({
        latitude: place.latitude,
        longitude: place.longitude,
        label: place.formattedAddress,
        accuracy: 'approximate',
        timestamp: Date.now(),
      });
      setIsChangingLocation(false);
      setCustomInput('');
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : 'Address could not be located.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const retryLocation = () => {
    setCustomLocation(null);
    onRetryLocation?.();
  };

  return (
    <div className={`space-y-6 flex-1 flex flex-col justify-between ${className}`}>
      <div className="space-y-6">
        {/* Title & Guidance */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
            <MapPin className="w-3.5 h-3.5" />
            <span>Pickup Geolocation</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">
            Confirm your real location
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
            ResQ requires precise coordinates from browser GPS or a verified geocoded address to calculate driving routes and find nearest facilities.
          </p>
        </div>

        {/* Location Unavailable Warning */}
        {isLocationUnavailable && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-xs text-amber-200 space-y-3 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100 text-sm">GPS Access Unavailable</p>
                <p className="leading-relaxed text-zinc-400">
                  Automatic GPS is unavailable or blocked. Enter an address manually or retry permission so ResQ can resolve real coordinates.
                </p>
              </div>
            </div>
            {onRetryLocation && (
              <button
                type="button"
                onClick={retryLocation}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry GPS Detection</span>
              </button>
            )}
          </div>
        )}

        {/* Selected Location Dark Glass Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              {valid ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              )}
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                {valid ? 'Authoritative Coordinates Set' : 'Location Not Detected'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsChangingLocation((value) => !value)}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isChangingLocation ? 'Cancel edit' : 'Enter custom address'}</span>
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 text-rose-400">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-white text-base block truncate">
                {valid ? selectedLocation.label : 'Waiting for a real location…'}
              </span>
              {valid && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[11px] text-zinc-300 font-mono bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/10">
                    GPS: {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    {selectedLocation.accuracy === 'high' ? 'High Precision GPS' : 'Approximate Area'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Address Search Form */}
          {isChangingLocation && (
            <div className="pt-4 border-t border-white/10 space-y-3">
              <label htmlFor="custom-loc-input" className="text-xs font-semibold text-zinc-300 block">
                Search pickup address or landmark
              </label>
              <div className="flex gap-2">
                <input
                  id="custom-loc-input"
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void applyAddress();
                    }
                  }}
                  placeholder="e.g. MI Road, Jaipur, Rajasthan"
                  className="flex-1 h-10 px-3.5 text-xs bg-white/[0.04] border border-white/10 rounded-xl text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => void applyAddress()}
                  disabled={!customInput.trim() || isGeocoding}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {isGeocoding ? 'Locating…' : 'Locate'}
                </button>
              </div>
              {geocodeError && (
                <p className="text-xs text-rose-400 font-medium">{geocodeError}</p>
              )}
            </div>
          )}
        </div>

        {/* Interactive Map Preview in Dark Frame */}
        <div className="border border-white/10 rounded-2xl overflow-hidden shadow-2xl bg-zinc-950/90 h-[260px] sm:h-[320px] relative">
          <MapView
            center={valid ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude } : undefined}
            userLocation={valid ? selectedLocation : undefined}
            options={{ styles: darkMapStyle }}
            interactive
            className="h-full w-full"
          />
          <div className="absolute bottom-3 left-3 z-20 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-mono text-zinc-300 border border-white/10 shadow-lg flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${valid ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{valid ? 'Live Coordinates Locked' : 'Waiting for coordinates'}</span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="pt-6 sticky bottom-0 bg-[#070709]/85 backdrop-blur-xl py-4 border-t border-white/10 -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-3 z-20">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-1/3 py-3.5 px-4 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] transition cursor-pointer"
          >
            Back
          </button>
        )}
        <button
          type="button"
          className={`${onBack ? 'w-2/3' : 'w-full'} flex items-center justify-center gap-2 rounded-xl py-3.5 px-6 bg-gradient-to-r from-rose-600 to-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-950/50 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer disabled:opacity-50`}
          onClick={() => onConfirmLocation(selectedLocation)}
          disabled={!valid || isGeocoding}
        >
          <span>Confirm & Search Hospitals</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
