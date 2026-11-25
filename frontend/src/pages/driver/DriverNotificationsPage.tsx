import { Bell, Radio, ShieldCheck } from 'lucide-react';

export const DriverNotificationsPage = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 font-sans">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono mb-2">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          <span>Realtime Telemetry & Dispatch Pings</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">Driver Dispatch Notifications</h1>
        <p className="text-xs md:text-sm text-zinc-400 mt-1">
          Live emergency dispatch pings, destination hospital pre-alerts, and telemetry status logs.
        </p>
      </div>

      {/* Notifications Container */}
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center shadow-xl space-y-4">
        <div className="bg-rose-500/10 text-rose-400 p-5 rounded-2xl border border-rose-500/20 inline-flex items-center justify-center shadow-lg shadow-rose-950/40">
          <Bell className="h-7 w-7" />
        </div>
        
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">No New Dispatch Alerts</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto mt-2 leading-relaxed">
            Keep your Duty toggle set to <span className="text-emerald-400 font-medium">ONLINE</span> to receive incoming emergency call offers and trauma hospital rendezvous alerts.
          </p>
        </div>

        <div className="pt-4 flex items-center justify-center gap-2 text-xs font-mono text-zinc-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Fleet Dispatch Socket Connected · 0 Pending Pings</span>
        </div>
      </div>
    </div>
  );
};
