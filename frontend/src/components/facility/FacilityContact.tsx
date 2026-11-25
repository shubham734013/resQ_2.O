import { useState } from 'react';
import {
  Building2,
  Phone,
  Clock,
  Copy,
  Check,
  MapPin,
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
    <div className={`bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl space-y-4 font-sans ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <MapPin className="w-4 h-4 text-rose-400" />
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
          Location & Contact Telemetry
        </span>
      </div>

      <div className="space-y-3.5 text-xs">
        {/* Address */}
        <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="flex items-start gap-3">
            <Building2 className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="text-zinc-500 block text-[11px] font-mono uppercase">Facility Address</span>
              <span className="font-medium text-zinc-200 leading-snug mt-0.5 block">
                {facility.address}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyAddress}
            aria-label="Copy address"
            className="p-2 text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl shrink-0 cursor-pointer transition-all"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Phone */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
          <Phone className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-zinc-500 block text-[11px] font-mono uppercase">Direct Department Line</span>
            <a
              href={`tel:${facility.phone.replace(/[^0-9+]/g, '')}`}
              className="font-mono font-medium text-rose-300 hover:text-rose-200 hover:underline mt-0.5 block"
            >
              {facility.phone}
            </a>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
          <Clock className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-zinc-500 block text-[11px] font-mono uppercase">Intake Hours</span>
            <span className="font-medium text-zinc-200 mt-0.5 block">
              {facility.openStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
