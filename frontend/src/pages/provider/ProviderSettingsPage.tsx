import { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export const ProviderSettingsPage = () => {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    autoDispatchEnabled: true,
    serviceRadiusKm: 25,
    maxConsecutiveDutyHours: 12,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl space-y-6 font-sans text-zinc-100">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Provider Fleet Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">Configure operational service bounds, dispatch automation, and driver duty limits</p>
      </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>Fleet operational settings updated and applied to dispatch router.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-white/10">
            <ShieldCheck className="h-4 w-4 text-rose-400" />
            <h2 className="text-base font-bold text-white tracking-tight">Algorithmic Dispatch Parameters</h2>
          </div>

          <div className="space-y-5">
            <label className="flex items-start gap-3.5 cursor-pointer p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
              <input
                type="checkbox"
                checked={settings.autoDispatchEnabled}
                onChange={(e) => setSettings({ ...settings, autoDispatchEnabled: e.target.checked })}
                className="mt-1 rounded border-white/20 bg-zinc-900 text-rose-600 focus:ring-rose-500/30 cursor-pointer"
              />
              <div>
                <p className="text-xs font-bold text-white">Enable Automated Driver Dispatch Offers</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Automatically routes high-priority emergency jobs to the closest available on-duty driver via Uber-style 30s countdown.
                </p>
              </div>
            </label>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <label className="block text-xs font-semibold text-zinc-200">
                Operating Service Radius (Kilometers)
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={settings.serviceRadiusKm}
                  onChange={(e) => setSettings({ ...settings, serviceRadiusKm: Number(e.target.value) })}
                  className="mt-2 h-11 w-full max-w-xs rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-zinc-100 outline-none focus:border-rose-500/50"
                />
              </label>
              <p className="text-[11px] text-zinc-400">
                Ambulance units outside this radius will not receive automatic dispatch matching for non-critical transfers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 px-6 text-sm font-bold text-white shadow-lg shadow-rose-950/60 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            Save Fleet Settings
          </button>
        </div>
      </form>
    </div>
  );
};
