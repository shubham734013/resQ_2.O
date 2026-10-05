import { User, Shield } from 'lucide-react';
import { Button } from '../components/common/Button';

export const ProfilePage = () => {
  return (
    <div className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          User & Emergency Profile
        </h1>
        <p className="text-sm text-slate-500">
          Manage emergency contacts, navigation preferences, and accessibility settings.
        </p>
      </header>

      {/* Emergency Contacts Placeholder */}
      <section className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Emergency Profile</h2>
            <p className="text-xs text-slate-500">Local emergency responder coordination details</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs py-2 border-b border-slate-100">
            <span className="text-slate-500">Default Emergency Services Number</span>
            <span className="font-semibold text-slate-900">911 (US / Canada)</span>
          </div>

          <div className="flex items-center justify-between text-xs py-2 border-b border-slate-100">
            <span className="text-slate-500">Emergency Contact #1</span>
            <span className="text-slate-700 font-medium">Not configured</span>
          </div>

          <div className="flex items-center justify-between text-xs py-2">
            <span className="text-slate-500">Medical ID / Blood Type</span>
            <span className="text-slate-700 font-medium">Unset</span>
          </div>
        </div>

        <Button variant="secondary" size="sm" fullWidth disabled>
          Edit Profile (Available in Next Release)
        </Button>
      </section>

      {/* App & Disclaimer Section */}
      <section className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3 shadow-xs text-xs text-slate-600">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Shield className="w-4 h-4 text-slate-700" />
          <span>About ResQ</span>
        </div>
        <p className="leading-relaxed">
          ResQ is a healthcare navigation and emergency coordination platform designed to help users quickly locate appropriate care facilities and navigate in urgent situations.
        </p>
        <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-lg text-amber-900 text-[11px] leading-relaxed">
          <strong>Important Medical Notice:</strong> ResQ does NOT diagnose medical conditions, provide direct medical advice, or replace standard emergency dispatch services. In a life-threatening emergency, always call local emergency responders immediately.
        </div>
        <div className="pt-2 text-[11px] text-slate-400">
          Version 0.1.0 • App Shell Foundation
        </div>
      </section>
    </div>
  );
};
