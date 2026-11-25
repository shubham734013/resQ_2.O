import { ArrowRight, Phone, Navigation as NavigationIcon, MapPin, Compass } from 'lucide-react';
import { MapView, darkMapStyle } from '../map/MapView';
import type { NavigationState } from '../../types/ambulance';
import type { RouteOptionItem } from '../../types/route';
import type { UserLocation } from '../../types/facility';

interface NavigationPanelProps {
  title: string;
  destinationName: string;
  destinationAddress: string;
  destinationCoordinates: { latitude: number; longitude: number };
  navigation: NavigationState;
  userLocation: UserLocation;
  route: RouteOptionItem;
  onAction: () => void;
  actionLabel: string;
  onCall?: () => void;
}

export const NavigationPanel = ({
  title,
  destinationName,
  destinationAddress,
  destinationCoordinates,
  navigation,
  userLocation,
  route,
  onAction,
  actionLabel,
  onCall,
}: NavigationPanelProps) => (
  <div className="flex flex-1 flex-col font-sans">
    <div className="grid flex-1 grid-rows-[minmax(320px,50vh)_auto] lg:grid-cols-[1.4fr_0.6fr] lg:grid-rows-none min-h-screen">
      {/* ── Google Maps Viewport with Dark Glass HUD Overlay ─────── */}
      <div className="relative min-h-[320px] overflow-hidden bg-[#070709] lg:min-h-full">
        <MapView
          userLocation={userLocation}
          center={userLocation}
          destination={{
            ...destinationCoordinates,
            name: destinationName,
            address: destinationAddress,
            isEmergency: title === 'Navigate to Patient',
          }}
          activeRoute={route}
          alternativeRoutes={[]}
          currentStepIndex={navigation.currentStepIndex}
          isNavigating
          interactive
          options={{ styles: darkMapStyle }}
          className="h-full w-full"
        />

        {/* Floating Dark Glass Live Instruction Overlay Card */}
        <div className="absolute left-3 right-3 top-4 z-30 sm:left-6 sm:right-auto sm:w-[440px]">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/85 px-5 py-4 backdrop-blur-xl shadow-2xl shadow-black/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-400 font-mono">
                <Compass className="h-3.5 w-3.5 animate-spin" />
                {title}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Turn-by-Turn
              </span>
            </div>
            <p className="text-base sm:text-lg font-semibold text-zinc-100 leading-snug">
              {navigation.instruction}
            </p>
          </div>
        </div>
      </div>

      {/* ── Dark Glass Side Instruction & Telemetry Sheet ────────── */}
      <aside className="flex flex-col bg-zinc-950/90 border-l border-white/10 backdrop-blur-xl text-zinc-100">
        <div className="flex-1 space-y-6 p-5 sm:p-7 overflow-y-auto">
          {/* Destination Header */}
          <div className="space-y-1.5 border-b border-white/10 pb-5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-400" />
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Target Waypoint</p>
            </div>
            <h1 className="text-xl sm:text-2xl font-light text-zinc-100 tracking-tight leading-tight">
              {destinationName}
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed">{destinationAddress}</p>
          </div>

          {/* Dark Telemetry Metrics: ETA & Distance */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
              <p className="text-[11px] font-mono text-zinc-400 uppercase">Estimated ETA</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-rose-300">{navigation.eta}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Realtime traffic routing</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
              <p className="text-[11px] font-mono text-zinc-400 uppercase">Remaining Distance</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-zinc-100">{navigation.distance}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">High-speed corridor</p>
            </div>
          </div>

          {/* Next Navigation Instruction Box */}
          <div className="flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-mono text-zinc-400 uppercase">Next Maneuver</p>
              <p className="mt-1 text-sm font-medium text-zinc-200 leading-snug">{navigation.instruction}</p>
            </div>
          </div>

          {/* Call Action Button */}
          {onCall && (
            <button
              type="button"
              onClick={onCall}
              className="flex items-center justify-center gap-2.5 w-full rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 font-semibold py-3 text-xs transition cursor-pointer"
            >
              <Phone className="h-4 w-4 text-emerald-400" />
              <span>Contact Target Contact / Dispatch</span>
            </button>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-0 border-t border-white/10 bg-zinc-950/95 p-5 backdrop-blur-md sm:p-6">
          <button
            type="button"
            onClick={onAction}
            className="flex items-center justify-center gap-2.5 w-full min-h-14 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-xl shadow-rose-950/60 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
          >
            <NavigationIcon className="h-4 w-4" />
            <span>{actionLabel}</span>
          </button>
        </div>
      </aside>
    </div>
  </div>
);
