import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation, Clock, Share2, ShieldCheck, Flame, HeartPulse } from 'lucide-react';
import type { Facility } from '../../types/facility';

export interface FacilityHeaderProps {
  facility: Facility;
  className?: string;
  onBack?: () => void;
}

export const FacilityHeader = ({
  facility,
  className = '',
  onBack,
}: FacilityHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: facility.name,
          text: `${facility.name} - ${facility.address} (${facility.phone})`,
          url: window.location.href,
        })
        .catch(() => {});
    }
  };

  return (
    <div className={`space-y-4 font-sans ${className}`}>
      {/* Top Bar: Glowing Back Action Pill & Share Action */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to facilities list"
          className="inline-flex items-center gap-2 text-xs font-mono text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl px-3.5 py-2 shadow-lg backdrop-blur-md transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
          <span>← Back</span>
        </button>

        <button
          type="button"
          aria-label="Share facility details"
          onClick={handleShare}
          className="p-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Badges Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {facility.emergencyAvailable ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">
            <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            24/7 Emergency Available
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <HeartPulse className="w-3.5 h-3.5 text-amber-400" />
            Urgent Care Services
          </span>
        )}
        {facility.verified && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Verified Facility
          </span>
        )}
      </div>

      {/* Main Title & Proximity Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight leading-tight">
            {facility.name}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-medium">
            {facility.type}
          </p>
        </div>

        {/* Distance & Travel Time Stat Card */}
        <div className="inline-flex items-center gap-3 bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-xl px-4 py-2.5 shrink-0 self-start shadow-lg">
          <div className="flex items-center gap-2 text-zinc-100 font-mono text-xs sm:text-sm font-semibold">
            <Navigation className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
            <span>{facility.distance}</span>
          </div>
          <span className="w-px h-3.5 bg-white/10" aria-hidden="true" />
          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
            <span>{facility.estimatedTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
