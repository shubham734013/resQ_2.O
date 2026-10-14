import { useState } from 'react';
import { MapPin, ArrowRight, RefreshCw, Edit3, AlertCircle } from 'lucide-react';
import type { UserLocation } from '../../types/facility';
import { mapsApi } from '../../services/mapsApi';
import { Button } from '../common/Button';
import { MapView } from '../map/MapView';

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
    <div className={`space-y-5 flex-1 flex flex-col justify-between ${className}`}>
      <div className="space-y-4">
        {/* Title & Guidance */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-[11px] font-semibold">
            <MapPin className="w-3.5 h-3.5 text-teal-600" />
            <span>Pickup Geolocation</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
            Confirm your real location
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
            ResQ requires precise coordinates from browser GPS or a verified geocoded address to calculate driving routes and find nearest facilities.
          </p>
        </div>

        {/* Location Unavailable Warning */}
        {isLocationUnavailable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-950">GPS Access Unavailable</p>
                <p className="leading-relaxed">
                  Automatic GPS is unavailable or blocked. Enter an address manually or retry permission so ResQ can resolve real coordinates.
                </p>
              </div>
            </div>
            {onRetryLocation && (
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={retryLocation}
                className="bg-white hover:bg-amber-100/50"
              >
                Retry GPS Detection
              </Button>
            )}
          </div>
        )}

        {/* Selected Location Card */}
        <div className="resq-card rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              {valid ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
                </span>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {valid ? 'Authoritative Coordinates Set' : 'Location Not Detected'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsChangingLocation((value) => !value)}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isChangingLocation ? 'Cancel edit' : 'Enter custom address'}</span>
            </button>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center shrink-0 text-teal-700">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-slate-900 text-sm sm:text-base block truncate">
                {valid ? selectedLocation.label : 'Waiting for a real location…'}
              </span>
              {valid && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                    GPS: {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                    {selectedLocation.accuracy === 'high' ? 'High Precision GPS' : 'Approximate Area'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Address Search Form */}
          {isChangingLocation && (
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <label htmlFor="custom-loc-input" className="text-xs font-semibold text-slate-800 block">
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
                  className="flex-1 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void applyAddress()}
                  disabled={!customInput.trim() || isGeocoding}
                  className="font-semibold"
                >
                  {isGeocoding ? 'Locating…' : 'Locate'}
                </Button>
              </div>
              {geocodeError && (
                <p className="text-xs text-rose-700 font-medium">{geocodeError}</p>
              )}
            </div>
          )}
        </div>

        {/* Interactive Map Preview */}
        <div className="resq-card rounded-2xl overflow-hidden h-[240px] sm:h-[300px] relative">
          <MapView
            center={valid ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude } : undefined}
            userLocation={valid ? selectedLocation : undefined}
            interactive
            className="h-full w-full"
          />
          <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 border border-slate-200/90 shadow-sm flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${valid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{valid ? 'Live Map Position' : 'Waiting for coordinates'}</span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="pt-4 sticky bottom-0 bg-slate-50/95 backdrop-blur-md py-3 border-t border-slate-200/90 -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-3 z-20">
        {onBack && (
          <Button
            variant="secondary"
            size="lg"
            onClick={onBack}
            className="w-1/3 font-semibold"
          >
            Back
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          fullWidth={!onBack}
          className={`${onBack ? 'w-2/3' : ''} shadow-sm font-bold`}
          onClick={() => onConfirmLocation(selectedLocation)}
          disabled={!valid || isGeocoding}
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
        >
          Confirm & Search Hospitals
        </Button>
      </div>
    </div>
  );
};
