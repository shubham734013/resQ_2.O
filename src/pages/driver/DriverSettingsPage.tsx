import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/common/Button';

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
      <div>
        <h1 className="text-2xl font-black text-slate-950">Driver Console & Telemetry Settings</h1>
        <p className="text-xs text-slate-500">Configure dispatch notification tones, GPS accuracy, and turn guidance</p>
      </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Driver console settings updated successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-950">Alerts & Telemetry Options</h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.loudEmergencyAlerts}
                onChange={(e) => setSettings({ ...settings, loudEmergencyAlerts: e.target.checked })}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">Loud Dispatch Sirens & Override Silent Mode</p>
                <p className="text-[11px] text-slate-500">Plays maximum-volume alert sounds during the 30-second dispatch job acceptance window.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.gpsHighAccuracy}
                onChange={(e) => setSettings({ ...settings, gpsHighAccuracy: e.target.checked })}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">High-Precision Satellite GPS Telemetry</p>
                <p className="text-[11px] text-slate-500">Sends sub-meter GPS fixes to destination hospitals and waiting patients every 5 seconds while on duty.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.hapticFeedbackOnOffer}
                onChange={(e) => setSettings({ ...settings, hapticFeedbackOnOffer: e.target.checked })}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">Continuous Haptic Vibration on Incoming Job Offer</p>
                <p className="text-[11px] text-slate-500">Vibrates the mobile device continuously until accepted or rejected.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary">
            Save Driver Preferences
          </Button>
        </div>
      </form>
    </div>
  );
};
