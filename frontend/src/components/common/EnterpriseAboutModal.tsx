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
                  FOR HEALTH TEAMS
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Tools for hospitals, ambulance teams, and emergency help
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close this box"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700">
          {/* Executive Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800">
              About ResQ
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              ResQ helps people, hospitals, and approved ambulance teams work together during emergencies. It can share a person’s location and health details, help find an ambulance, and let a hospital get ready before it arrives.
            </p>
          </div>

          {/* Key Enterprise Capabilities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Ambulance className="w-4 h-4 text-teal-600" />
                <span>Ambulance team tools</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                ResQ helps find an available ambulance, send directions, and share trip updates. If one way to send updates fails, it can try another.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Building2 className="w-4 h-4 text-teal-600" />
                Hospital emergency care
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hospitals can learn when an ambulance is coming and check which beds are open, including intensive care beds.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                Checked hospital list
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Find hospitals that have been checked by ResQ. Hospital teams can list the care they offer, such as injury, heart, stroke, or child care.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Lock className="w-4 h-4 text-teal-600" />
                Safe health information
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                ResQ follows HL7 FHIR, a set of health data rules. It keeps emergency help separate from regular clinic visits and records when health details are used.
              </p>
            </div>
          </div>

          {/* Compliance & Regulatory Certifications */}
          <div className="p-4 rounded-xl border border-teal-200/80 bg-teal-50/40 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-950 uppercase tracking-wider">
              <Award className="w-4 h-4 text-teal-700" />
              <span>Health and safety rules</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { name: 'HIPAA Ready', desc: 'Health privacy rules' },
                { name: 'HL7 FHIR v4', desc: 'Health data rules' },
                { name: 'ISO 27001', desc: 'Data safety rules' },
                { name: 'NABH Aligned', desc: 'Hospital care rules' },
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
              <p className="font-semibold text-slate-900">Join ResQ</p>
              <p className="text-slate-500">Contact us to connect your hospital or ambulance service.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Phone className="w-3.5 h-3.5 text-teal-600" />}
                onClick={() => { window.location.href = 'tel:112'; }}
              >
                Call 112
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
