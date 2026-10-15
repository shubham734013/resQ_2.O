import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/common/Button';

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
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Hospital Facility & Operational Settings</h1>
        <p className="text-xs text-slate-500">Configure triage automation, pre-arrival emergency alert sounds, and bed thresholds</p>
      </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Facility configuration parameters updated successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-950">Emergency Intake Protocol</h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.audioAlerts}
                onChange={(e) => setSettings({ ...settings, audioAlerts: e.target.checked })}
                className="mt-1 rounded text-teal-600 focus:ring-teal-500"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">Audible Sirens on High-Acuity Incoming Ambulances</p>
                <p className="text-[11px] text-slate-500">Plays an audio alert tone on the clinical coordination dashboard when an ambulance enters the 5-kilometer trauma radius.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.traumaPreAlertNotification}
                onChange={(e) => setSettings({ ...settings, traumaPreAlertNotification: e.target.checked })}
                className="mt-1 rounded text-teal-600 focus:ring-teal-500"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">SMS Pre-Alerts to On-Call Chief Medical Officer</p>
                <p className="text-[11px] text-slate-500">Sends automated SMS summaries for cardiac arrest, severe trauma, and stroke requests.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary">
            Save Facility Configuration
          </Button>
        </div>
      </form>
    </div>
  );
};
