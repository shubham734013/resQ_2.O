import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/common/Button';

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
    <div className="max-w-4xl space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Provider Fleet Settings</h1>
        <p className="text-xs text-slate-500">Configure operational service bounds, dispatch automation, and driver duty limits</p>
      </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Fleet operational settings updated successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-950">Dispatch Parameters</h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoDispatchEnabled}
                onChange={(e) => setSettings({ ...settings, autoDispatchEnabled: e.target.checked })}
                className="mt-1 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">Enable Automated Driver Dispatch Offers</p>
                <p className="text-[11px] text-slate-500">Automatically routes high-priority emergency jobs to the closest available on-duty driver via Uber-style 30s countdown.</p>
              </div>
            </label>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700">
                Operating Service Radius (Kilometers)
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={settings.serviceRadiusKm}
                  onChange={(e) => setSettings({ ...settings, serviceRadiusKm: Number(e.target.value) })}
                  className="mt-1 h-10 w-full max-w-xs rounded-xl border border-slate-200 px-3 text-sm focus:border-blue-600 outline-none"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary">
            Save Fleet Settings
          </Button>
        </div>
      </form>
    </div>
  );
};
