import { useState } from 'react';
import { Shield, HeartHandshake, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/common/Button';

export const UserSettingsPage = () => {
  const [saved, setSaved] = useState(false);

  const [emergencyContact, setEmergencyContact] = useState({
    name: 'Anjali Sharma',
    phone: '+91 98765 43210',
    relationship: 'Family / Spouse',
  });

  const [prefs, setPrefs] = useState({
    smsAlerts: true,
    liveTrackingShare: true,
    clinicalPreAlertConsent: true,
    highAccuracyGps: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Account and safety settings</h1>
        <p className="text-xs text-slate-500">Choose your emergency contacts, alerts, and privacy settings.</p>
      </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Your safety settings and emergency contacts were saved.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Emergency Contacts Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2.5 text-slate-950 font-bold mb-4">
            <HeartHandshake className="h-5 w-5 text-rose-600" />
            <h2 className="text-base font-bold">Main emergency contact</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            When you ask for emergency help, ResQ may text this person with hospital and ambulance updates.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">
              Full name
              <input
                type="text"
                required
                value={emergencyContact.name}
                onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-teal-600 outline-none"
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Phone Number
              <input
                type="tel"
                required
                value={emergencyContact.phone}
                onChange={(e) => setEmergencyContact({ ...emergencyContact, phone: e.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-teal-600 outline-none"
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              How do you know them?
              <input
                type="text"
                required
                value={emergencyContact.relationship}
                onChange={(e) => setEmergencyContact({ ...emergencyContact, relationship: e.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-teal-600 outline-none"
              />
            </label>
          </div>
        </div>

        {/* Telemetry & Privacy Preferences */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 text-slate-950 font-bold mb-2">
            <Shield className="h-5 w-5 text-teal-600" />
            <h2 className="text-base font-bold">Safety and data choices</h2>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.liveTrackingShare}
                onChange={(e) => setPrefs({ ...prefs, liveTrackingShare: e.target.checked })}
                className="mt-1 rounded text-teal-600 focus:ring-teal-500"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">Share your live location with family</p>
                <p className="text-[11px] text-slate-500">Makes a link that works for a short time. Share it with your emergency contacts while an SOS is open.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.clinicalPreAlertConsent}
                onChange={(e) => setPrefs({ ...prefs, clinicalPreAlertConsent: e.target.checked })}
                className="mt-1 rounded text-teal-600 focus:ring-teal-500"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">Send health details to the hospital</p>
                <p className="text-[11px] text-slate-500">If turned on, the ambulance team can send details about the emergency to the hospital before you arrive.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.highAccuracyGps}
                onChange={(e) => setPrefs({ ...prefs, highAccuracyGps: e.target.checked })}
                className="mt-1 rounded text-teal-600 focus:ring-teal-500"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">Share your phone's location</p>
                <p className="text-[11px] text-slate-500">Lets your phone share its location to help the ambulance find you.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary">
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
};
