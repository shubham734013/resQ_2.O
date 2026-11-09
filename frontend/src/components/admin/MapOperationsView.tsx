import { MapPinned } from 'lucide-react';
import { MapView } from '../map/MapView';

export const MapOperationsView = () => (
  <div className="relative h-[360px] overflow-hidden bg-slate-100 sm:h-[430px]">
    <MapView
      center={{ latitude: 20.5937, longitude: 78.9629 }}
      zoom={5}
      interactive
      className="h-full w-full"
    />
    <div className="absolute left-4 top-4 z-20 max-w-xs border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-start gap-2">
        <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
        <div>
          <p className="text-xs font-semibold text-slate-900">Operations map</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Live hospital, emergency, and ambulance overlays will appear here as operational events are connected.
          </p>
        </div>
      </div>
    </div>
  </div>
);
