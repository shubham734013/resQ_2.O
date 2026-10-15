import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, ShieldCheck, Activity, Award, Phone, ExternalLink, CheckCircle2 } from 'lucide-react';
import { EnterpriseAboutModal } from './EnterpriseAboutModal';

export interface EnterpriseFooterProps {
  className?: string;
}

export const EnterpriseFooter = ({ className = '' }: EnterpriseFooterProps) => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <>
      <footer
        role="contentinfo"
        aria-label="ResQ Enterprise Footer"
        className={`bg-slate-900 text-slate-300 border-t border-slate-800 ${className}`}
      >
        {/* Top Corporate Status Bar */}
        <div className="border-b border-slate-800 bg-slate-950/80 px-4 sm:px-6 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Enterprise Dispatch Engine: 99.99% Target Uptime SLA</span>
              </span>
              <span className="text-slate-600 hidden md:inline">|</span>
              <span className="text-slate-400 hidden md:inline">
                Jaipur Metro Clinical & Fleet Network
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <button
                type="button"
                onClick={() => setIsAboutOpen(true)}
                className="hover:text-teal-400 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
              >
                <span>About ResQ Health Technologies</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              <span className="text-slate-700">|</span>
              <a
                href="tel:112"
                className="hover:text-rose-400 transition-colors flex items-center gap-1 text-rose-300 font-bold"
              >
                <Phone className="w-3 h-3 text-rose-400" />
                <span>National Emergency: 112</span>
              </a>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Brand & Corporate Overview */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 text-white flex items-center justify-center font-bold text-base">
                  <Compass className="w-5 h-5 text-teal-400" aria-hidden="true" />
                </div>
                <div>
                  <span className="font-black text-white text-lg tracking-tight flex items-center gap-1">
                    ResQ Health Technologies™
                  </span>
                  <p className="text-[11px] text-teal-400 font-semibold uppercase tracking-wider">
                    Enterprise Healthcare & Emergency Network
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Cloud-native clinical dispatch infrastructure delivering synchronized triage, ambulance CAD, bed telemetry, and scheduled outpatient appointments across healthcare systems.
              </p>

              {/* Compliance & Trust Seals */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                {[
                  { label: 'HIPAA Ready', icon: ShieldCheck },
                  { label: 'HL7 FHIR v4', icon: Activity },
                  { label: 'ISO 27001', icon: Award },
                  { label: 'NABH Aligned', icon: CheckCircle2 },
                ].map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700/80 text-[10px] font-semibold text-slate-300"
                  >
                    <Icon className="w-3 h-3 text-teal-400" />
                    <span>{label}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Column 1: Emergency & Dispatch */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Emergency Dispatch
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <NavLink to="/sos" className="hover:text-white transition-colors">
                    1-Click Emergency SOS
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/search" className="hover:text-white transition-colors">
                    Verified Emergency Hospitals
                  </NavLink>
                </li>
                <li>
                  <span className="text-slate-500">Realtime CAD Routing</span>
                </li>
                <li>
                  <span className="text-slate-500">Live Ambulance Telemetry</span>
                </li>
                <li>
                  <span className="text-slate-500">Hospital Pre-Arrival Queue</span>
                </li>
              </ul>
            </div>

            {/* Column 2: Clinical Care & Appointments */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Hospital Network
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <NavLink to="/appointments" className="hover:text-white transition-colors">
                    Appointments & Care Requests
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/search" className="hover:text-white transition-colors">
                    Multi-Specialty Directory
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/saved" className="hover:text-white transition-colors">
                    Saved Medical Facilities
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/profile" className="hover:text-white transition-colors">
                    Patient Medical Identity
                  </NavLink>
                </li>
                <li>
                  <span className="text-slate-500">Bed & ICU Telemetry</span>
                </li>
              </ul>
            </div>

            {/* Column 3: Enterprise Portals */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Enterprise Portals
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <NavLink to="/hospital" className="hover:text-teal-400 transition-colors flex items-center gap-1 font-semibold text-slate-300">
                    <span>Hospital Command Center</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/ambulance-provider" className="hover:text-teal-400 transition-colors flex items-center gap-1 font-semibold text-slate-300">
                    <span>Fleet Provider CAD</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/ambulance" className="hover:text-teal-400 transition-colors flex items-center gap-1 font-semibold text-slate-300">
                    <span>Ambulance Driver Console</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/admin" className="hover:text-teal-400 transition-colors flex items-center gap-1 font-semibold text-slate-300">
                    <span>Network Operations & Governance</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/login" className="hover:text-white transition-colors">
                    Enterprise Staff Sign-In
                  </NavLink>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright and Legal Bar */}
          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} ResQ Health Technologies Inc. All rights reserved. Enterprise Emergency Coordination Platform.
            </p>
            <div className="flex items-center gap-4">
              <span className="hover:text-slate-400 cursor-pointer" onClick={() => setIsAboutOpen(true)}>
                Platform Architecture
              </span>
              <span>&bull;</span>
              <span className="hover:text-slate-400 cursor-pointer">
                Security & Data Privacy
              </span>
              <span>&bull;</span>
              <span className="hover:text-slate-400 cursor-pointer">
                Terms of Service
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Corporate Overview Modal */}
      <EnterpriseAboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </>
  );
};
