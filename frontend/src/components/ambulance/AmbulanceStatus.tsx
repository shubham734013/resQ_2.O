import type { AmbulanceAvailability } from '../../types/ambulance';

export const AmbulanceStatus = ({ status }: { status: AmbulanceAvailability }) => {
  if (status === 'available') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Online · Dispatch Ready
      </span>
    );
  }
  if (status === 'busy') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
        Online · On Active Trip
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono font-semibold bg-white/[0.04] text-zinc-400 border border-white/10">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      Offline · Off Duty
    </span>
  );
};
