import { useState } from 'react';
import { CheckCircle2, Sliders, Volume2, Satellite, Vibrate, Shield } from 'lucide-react';

export const DriverSettingsPage = () => {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    loudEmergencyAlerts: true,
    gpsHighAccuracy: true,
    autoSpeakTurnInstructions: true,
    hapticFeedbackOnOffer: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 font-sans">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono mb-2">
          <Sliders className="h-3.5 w-3.5" />
          <span>Alert and location settings</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">Driver settings</h1>
      </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center gap-3 text-xs text-emerald-300 backdrop-blur-md">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>Your alert and location settings were saved.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5">
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Alerts and location</h2>

          <div className="space-y-3">
            <label className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-start gap-3.5 cursor-pointer hover:bg-white/[0.04] transition">
              <input
                type="checkbox"
                checked={settings.loudEmergencyAlerts}
                onChange={(e) => setSettings({ ...settings, loudEmergencyAlerts: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-zinc-900 text-rose-600 focus:ring-rose-500/40 cursor-pointer accent-rose-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-rose-400" />
                  <p className="text-xs font-semibold text-zinc-200">Play loud emergency alerts</p>
                </div>
              </div>
            </label>

            <label className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-start gap-3.5 cursor-pointer hover:bg-white/[0.04] transition">
              <input
                type="checkbox"
                checked={settings.gpsHighAccuracy}
                onChange={(e) => setSettings({ ...settings, gpsHighAccuracy: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-zinc-900 text-rose-600 focus:ring-rose-500/40 cursor-pointer accent-rose-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Satellite className="h-4 w-4 text-emerald-400" />
                  <p className="text-xs font-semibold text-zinc-200">Use precise location</p>
                </div>
              </div>
            </label>

            <label className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-start gap-3.5 cursor-pointer hover:bg-white/[0.04] transition">
              <input
                type="checkbox"
                checked={settings.hapticFeedbackOnOffer}
                onChange={(e) => setSettings({ ...settings, hapticFeedbackOnOffer: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-zinc-900 text-rose-600 focus:ring-rose-500/40 cursor-pointer accent-rose-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Vibrate className="h-4 w-4 text-amber-400" />
                  <p className="text-xs font-semibold text-zinc-200">Vibrate for new requests</p>
                </div>
              </div>
            </label>
          </div>

          <div className="pt-2 flex items-center gap-2 text-xs text-zinc-500">
            <Shield className="h-4 w-4 text-zinc-500" />
            <span>Location is used to help guide the ambulance.</span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-sm font-semibold text-white shadow-lg shadow-rose-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
};
