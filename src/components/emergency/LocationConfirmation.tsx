import { useState } from 'react';
import { MapPin, ArrowRight, RefreshCw, Edit3, Check, AlertCircle } from 'lucide-react';
import type { UserLocation } from '../../types/facility';
import { Button } from '../common/Button';
import { MapPlaceholder } from '../map/MapPlaceholder';

export interface LocationConfirmationProps {
  currentLocation: UserLocation;
  onConfirmLocation: (location: UserLocation) => void;
  onBack?: () => void;
  isLocationUnavailable?: boolean;
  onRetryLocation?: () => void;
  className?: string;
}

const ALTERNATIVE_MOCK_LOCATIONS: UserLocation[] = [
  {
    latitude: 37.7749,
    longitude: -122.4194,
    label: 'Downtown Medical District, SF',
    accuracy: 'high',
  },
  {
    latitude: 37.7612,
    longitude: -122.4191,
    label: 'Mission District, 24th & Mission St, SF',
    accuracy: 'high',
  },
  {
    latitude: 37.7858,
    longitude: -122.4215,
    label: 'Van Ness Corridor & Civic Center, SF',
    accuracy: 'high',
  },
];

export const LocationConfirmation = ({
  currentLocation,
  onConfirmLocation,
  onBack,
  isLocationUnavailable = false,
  onRetryLocation,
  className = '',
}: LocationConfirmationProps) => {
  const [selectedLocation, setSelectedLocation] = useState<UserLocation>(currentLocation);
  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const handleApplyCustom = () => {
    if (!customInput.trim()) return;
    const newLoc: UserLocation = {
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      label: customInput.trim(),
      accuracy: 'approximate',
    };
    setSelectedLocation(newLoc);
    setIsChangingLocation(false);
  };

  // If location is completely unavailable
  if (isLocationUnavailable) {
    return (
      <div className={`space-y-6 max-w-lg mx-auto text-center py-6 ${className}`}>
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Location Access Unavailable</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            We could not automatically detect your GPS location. Please retry or select your approximate location below.
          </p>
        </div>

        <div className="space-y-2 text-left bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-700 block mb-2">Select your approximate area:</span>
          {ALTERNATIVE_MOCK_LOCATIONS.map((loc) => (
            <button
              key={loc.label}
              type="button"
              onClick={() => {
                setSelectedLocation(loc);
                onConfirmLocation(loc);
              }}
              className="w-full text-left text-xs p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>{loc.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ))}
        </div>

        {onRetryLocation && (
          <Button
            variant="outline"
            size="md"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={onRetryLocation}
          >
            Retry Location Fix
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-5 flex-1 flex flex-col justify-between ${className}`}>
      <div className="space-y-4">
        {/* Title Header */}
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
            Confirm your location
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Emergency routing calculates travel time and road access from this position.
          </p>
        </div>

        {/* Current Location Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Current Location Fix
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsChangingLocation((c) => !c)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>{isChangingLocation ? 'Cancel' : 'Change location'}</span>
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
              <MapPin className="w-5 h-5 text-slate-800" aria-hidden="true" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm sm:text-base block">
                {selectedLocation.label}
              </span>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                GPS: {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)} • High Accuracy
              </span>
            </div>
          </div>

          {/* Change Location Drawer/Input */}
          {isChangingLocation && (
            <div className="pt-3 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-150">
              <label htmlFor="custom-loc-input" className="text-xs font-semibold text-slate-700 block">
                Type address or select nearby reference:
              </label>
              <div className="flex gap-2">
                <input
                  id="custom-loc-input"
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g. 500 Market St, San Francisco, CA"
                  className="flex-1 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyCustom}
                  disabled={!customInput.trim()}
                >
                  Apply
                </Button>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-[11px] text-slate-400 block font-medium">Quick reference locations:</span>
                <div className="grid grid-cols-1 gap-1">
                  {ALTERNATIVE_MOCK_LOCATIONS.map((loc) => (
                    <button
                      key={loc.label}
                      type="button"
                      onClick={() => {
                        setSelectedLocation(loc);
                        setIsChangingLocation(false);
                      }}
                      className={`text-left text-xs p-2 rounded-md border flex items-center justify-between cursor-pointer ${
                        selectedLocation.label === loc.label
                          ? 'bg-slate-900 text-white border-slate-950 font-medium'
                          : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{loc.label}</span>
                      {selectedLocation.label === loc.label && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Embedded Map Canvas Frame */}
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs h-[240px] sm:h-[280px] relative">
          <MapPlaceholder
            facilities={[]}
            selectedFacility={null}
            userLocation={selectedLocation}
            onSelectFacility={() => {}}
          />
          <div className="absolute bottom-2 left-3 z-20 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-slate-600 font-mono shadow-xs border border-slate-200/80">
            Coordinates verified for emergency routing
          </div>
        </div>
      </div>

      {/* Sticky/Fixed Bottom Action */}
      <div className="pt-4 sticky bottom-0 bg-slate-50/95 backdrop-blur-xs py-3 border-t border-slate-200/80 -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-3">
        {onBack && (
          <Button
            variant="secondary"
            size="lg"
            onClick={onBack}
            className="w-1/3"
          >
            Back
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          fullWidth={!onBack}
          className={onBack ? 'w-2/3' : ''}
          onClick={() => onConfirmLocation(selectedLocation)}
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          aria-label="Use this location and find care"
        >
          Use this location
        </Button>
      </div>
    </div>
  );
};
