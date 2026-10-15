import { HelpCircle, AlertTriangle, Ambulance, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';

export const HelpPage = () => {
  const faqs = [
    {
      q: 'How does the Emergency SOS workflow work?',
      a: 'When you tap "Trigger Emergency SOS", ResQ immediately requests your GPS location and matches you with the nearest specialized hospital and certified ambulance. Real-time telemetry lets both you and the triage team track the ambulance live.',
    },
    {
      q: 'How are routine appointments different from Emergency SOS?',
      a: 'Routine appointments and direct hospital care requests are non-emergency. They are handled by our concurrency-safe booking engine and direct messaging desk, strictly isolated from emergency dispatch channels so 108/112 response queues remain clear.',
    },
    {
      q: 'How do Hospital and Ambulance registrations get approved?',
      a: 'Healthcare institutions and fleet providers submit medical registration numbers and vehicle certifications. ResQ State Administrators review these credentials through official ABDM registries before approving operational portal access.',
    },
    {
      q: 'Can ambulance drivers toggle their duty status?',
      a: 'Yes. Certified ambulance drivers can go On Duty or Off Duty from their console. Only on-duty drivers with fresh GPS telemetry receive dispatch job offers.',
    },
    {
      q: 'Is my health and location data protected?',
      a: 'Yes. ResQ utilizes TLS 1.3 encryption, HTTP-only secure session cookies, role-based database access, and strict ISO 27001 data isolation between patients, hospitals, and fleet providers.',
    },
  ];

  return (
    <div className="bg-slate-50 text-slate-900 font-sans py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 mb-3">
            <HelpCircle className="h-4 w-4" /> Help Center & Knowledge Base
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-slate-600 text-sm">
            Everything you need to know about using ResQ 2.0 emergency workflows, hospital bookings, and role portals.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 sm:grid-cols-3 mb-12">
          <Link
            to={ROUTES.USER.EMERGENCY}
            className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 hover:bg-rose-50 transition"
          >
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-rose-950">Citizen SOS Guide</p>
              <p className="text-[11px] text-rose-700">How to request emergency help</p>
            </div>
          </Link>

          <Link
            to={ROUTES.USER.HOSPITALS}
            className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 hover:bg-teal-50 transition"
          >
            <Building2 className="h-5 w-5 text-teal-700 shrink-0" />
            <div>
              <p className="text-xs font-bold text-teal-950">Hospital Discovery</p>
              <p className="text-[11px] text-teal-700">Find verified facilities & beds</p>
            </div>
          </Link>

          <Link
            to={ROUTES.PUBLIC.REGISTER}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition shadow-xs"
          >
            <Ambulance className="h-5 w-5 text-slate-700 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-950">Provider Onboarding</p>
              <p className="text-[11px] text-slate-500">Fleet and driver registration</p>
            </div>
          </Link>
        </div>

        {/* FAQs */}
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-950">{faq.q}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
