import { X, ShieldCheck, Activity, Building2, Ambulance, Lock, Award, Phone } from 'lucide-react';
import { Button } from './Button';

export interface EnterpriseAboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnterpriseAboutModal = ({ isOpen, onClose }: EnterpriseAboutModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="enterprise-modal-title"
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center font-bold text-lg">
              <Activity className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="enterprise-modal-title" className="text-base font-bold text-white tracking-tight">
                  ResQ Health Technologies™
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Real-Time Clinical Triage, Fleet CAD & Emergency Logistics Platform
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700">
          {/* Executive Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Corporate Mission & Architecture
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              ResQ Health Technologies is a cloud-native healthcare infrastructure company providing synchronized, double-blind coordination between citizens, hospital emergency triage centers, and certified ambulance fleets. Our platform bridges the critical 15-minute emergency care gap with authoritative geospatial routing and automated clinical matching.
            </p>
          </div>

          {/* Key Enterprise Capabilities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Ambulance className="w-4 h-4 text-teal-600" />
                <span>Enterprise Fleet CAD</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Computer-Aided Dispatch (CAD) engine utilizing sub-second driver reservation locks, live telemetry streaming, and automated failover.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span>Hospital Triage Command</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Emergency department pre-arrival notifications, live bed/ICU telemetry, and double-blind intake verification.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Verified Facility Directory</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                100% verified clinical directory with declared specialties (Trauma, STEMI Cardiac, Stroke, Pediatric) and real-time intake telemetry.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Lock className="w-4 h-4 text-teal-600" />
                <span>Clinical Interoperability</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                HL7 FHIR v4 compatibility, end-to-end audit logging, and zero-compromise separation between emergency SOS and routine clinic appointments.
              </p>
            </div>
          </div>

          {/* Compliance & Regulatory Certifications */}
          <div className="p-4 rounded-xl border border-teal-200/80 bg-teal-50/40 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-950 uppercase tracking-wider">
              <Award className="w-4 h-4 text-teal-700" />
              <span>Enterprise Compliance & Security Standards</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { name: 'HIPAA Ready', desc: 'Protected Health Info' },
                { name: 'HL7 FHIR v4', desc: 'Clinical Data Standard' },
                { name: 'ISO 27001', desc: 'InfoSec Certified' },
                { name: 'NABH Aligned', desc: 'Hospital Quality' },
              ].map((badge) => (
                <div key={badge.name} className="bg-white p-2.5 rounded-lg border border-teal-200/70 text-center">
                  <span className="font-bold text-slate-900 block text-[11px]">{badge.name}</span>
                  <span className="text-[10px] text-slate-500 block">{badge.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Partner & Hospital Integration Contact */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div>
              <p className="font-semibold text-slate-900">Hospital & Fleet Network Onboarding</p>
              <p className="text-slate-500">Contact enterprise partnerships to connect your hospital or fleet.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Phone className="w-3.5 h-3.5 text-teal-600" />}
                onClick={() => { window.location.href = 'tel:112'; }}
              >
                Dispatch: 112
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
              >
                Close Overview
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
