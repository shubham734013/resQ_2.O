import { Bell } from 'lucide-react';

export const ProviderNotificationsPage = () => {
  return (
    <div className="space-y-6 font-sans text-zinc-100">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Provider Operational Notifications</h1>
        <p className="text-xs text-zinc-400 mt-1">Fleet dispatches, driver duty status alerts, and state emergency broadcasts</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-16 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4 shadow-lg shadow-rose-950/40">
          <Bell className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-white">No Pending Fleet Alerts</h2>
        <p className="text-xs text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
          All ambulance units are operating nominally within designated geographic service polygons. Radio telemetry is active.
        </p>
      </div>
    </div>
  );
};
