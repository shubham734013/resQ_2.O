import { useState } from 'react';
import { CheckCircle2, Sliders, BellRing } from 'lucide-react';

export const HospitalSettingsPage = () => {
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({
    audioAlerts: true,
    autoAcceptTriage: false,
    traumaPreAlertNotification: true,
    capacityThreshold: 90,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Hospital settings</h1>
        <p className="text-xs text-zinc-400 mt-1">Set emergency alerts and bed warnings.</p>
      </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-xl p-4 flex items-center gap-3 text-xs text-emerald-300 font-mono shadow-lg shadow-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Your hospital settings were saved.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <BellRing className="w-4 h-4 text-rose-400" />
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Emergency alerts</h2>
          </div>

          <div className="space-y-3">
            <label className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/15 transition-all flex items-start gap-3.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.audioAlerts}
                onChange={(e) => setSettings({ ...settings, audioAlerts: e.target.checked })}
                className="mt-0.5 rounded accent-rose-500 w-4 h-4"
              />
              <div>
                <p className="text-xs font-semibold text-zinc-200 group-hover:text-rose-300 transition-colors">
                  Play an alert when an ambulance is coming
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Play a sound on this page when an ambulance is within 5 kilometers of the hospital.
                </p>
              </div>
            </label>

            <label className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/15 transition-all flex items-start gap-3.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.traumaPreAlertNotification}
                onChange={(e) => setSettings({ ...settings, traumaPreAlertNotification: e.target.checked })}
                className="mt-0.5 rounded accent-rose-500 w-4 h-4"
              />
              <div>
                <p className="text-xs font-semibold text-zinc-200 group-hover:text-rose-300 transition-colors">
                  Text the on-call medical lead before arrival
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Send a text summary for cardiac arrest, serious injuries, and stroke requests.
                </p>
              </div>
            </label>

            <label className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/15 transition-all flex items-start gap-3.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.autoAcceptTriage}
                onChange={(e) => setSettings({ ...settings, autoAcceptTriage: e.target.checked })}
                className="mt-0.5 rounded accent-rose-500 w-4 h-4"
              />
              <div>
                <p className="text-xs font-semibold text-zinc-200 group-hover:text-rose-300 transition-colors">
                  Accept urgent injury alerts when over 20% of beds are free
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Move life-threatening cases to the preparation step without waiting for a doctor to accept them.
                </p>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Bed warning level</span>
              </div>
              <span className="text-xs font-mono font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-lg">
                {settings.capacityThreshold}% full
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              value={settings.capacityThreshold}
              onChange={(e) => setSettings({ ...settings, capacityThreshold: Number(e.target.value) })}
              className="w-full accent-rose-500"
            />
            <p className="text-[11px] text-zinc-400">
              Warn the city dispatch center when more than this share of beds are in use.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-500 shadow-lg shadow-rose-950/50 hover:from-rose-500 hover:to-rose-400 transition-all"
          >
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
};
