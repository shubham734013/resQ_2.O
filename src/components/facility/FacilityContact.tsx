import { useState } from 'react';
import {
  Building2,
  Phone,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import type { Facility } from '../../types/facility';

export interface FacilityContactProps {
  facility: Facility;
  className?: string;
}

export const FacilityContact = ({
  facility,
  className = '',
}: FacilityContactProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    navigator.clipboard?.writeText(facility.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3.5 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block border-b border-slate-100 pb-2">
        Location & Contact Information
      </span>

      <div className="space-y-3 text-xs">
        {/* Address */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="text-slate-500 block text-[11px]">Facility Address</span>
              <span className="font-medium text-slate-900 leading-snug">
                {facility.address}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyAddress}
            aria-label="Copy address"
            className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Phone */}
        <div className="flex items-start gap-2.5 pt-2 border-t border-slate-50">
          <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-slate-500 block text-[11px]">Direct Department Line</span>
            <a
              href={`tel:${facility.phone.replace(/[^0-9+]/g, '')}`}
              className="font-mono font-medium text-slate-900 hover:underline"
            >
              {facility.phone}
            </a>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="flex items-start gap-2.5 pt-2 border-t border-slate-50">
          <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-slate-500 block text-[11px]">Intake Hours</span>
            <span className="font-medium text-slate-800">
              {facility.openStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
