import { Shield, Clock, HeartPulse, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';

export const AboutPage = () => {
  return (
    <div className="bg-slate-50 text-slate-900 font-sans">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 py-20 text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-xs font-semibold text-teal-300 mb-6">
            <HeartPulse className="h-4 w-4" /> Next-Generation Healthcare Infrastructure
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Saving Lives Through Connected Emergency Coordination
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed">
            ResQ 2.0 unifies citizens, hospitals, and ambulance fleets across Rajasthan into a zero-latency, telemetry-driven emergency network.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to={ROUTES.USER.EMERGENCY}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-3 font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-700 transition"
            >
              Trigger Emergency SOS
            </Link>
            <Link
              to={ROUTES.PUBLIC.HELP}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              Platform Overview
            </Link>
          </div>
        </div>
      </section>

      {/* Mission & Values */}
      <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-100 mb-4">
              <Clock className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-950">Sub-Minute Dispatch</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Automated algorithmic matching dispatches the nearest certified ALS/BLS ambulance based on real GPS traffic telemetry, cutting emergency wait times by up to 60%.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100 mb-4">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-950">Hospital Triage Pre-Alerts</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Trauma and emergency rooms receive real-time vitals, ETA, and incoming ambulance telemetry before arrival so clinical teams are scrubbed in and ready.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 mb-4">
              <Shield className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-950">Enterprise Governance</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Fully compliant with Ayushman Bharat Digital Mission (ABDM), ISO 27001, and SOC-2 standards. Zero fake GPS, zero unverified drivers.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
