import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation, Clock, Share2 } from 'lucide-react';
import type { Facility } from '../../types/facility';
import { StatusBadge } from '../common/StatusBadge';
import { IconButton } from '../common/IconButton';

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
    <div className={`space-y-3 ${className}`}>
      {/* Top Bar: Back Action & Share Action */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to facilities list"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200/90 rounded-lg px-2.5 py-1.5 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back</span>
        </button>

        <IconButton
          icon={<Share2 className="w-3.5 h-3.5" />}
          size="sm"
          variant="default"
          aria-label="Share facility details"
          onClick={handleShare}
        />
      </div>

      {/* Badges Bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {facility.emergencyAvailable ? (
          <StatusBadge variant="emergency" label="24/7 Emergency Available" />
        ) : (
          <StatusBadge variant="urgent" label="Urgent Care Services" />
        )}
        {facility.verified && <StatusBadge variant="verified" label="Verified Facility" />}
      </div>

      {/* Main Title & Proximity Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 leading-tight">
            {facility.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {facility.type}
          </p>
        </div>

        {/* Distance & Travel Time Stat Card */}
        <div className="inline-flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 shrink-0 self-start">
          <div className="flex items-center gap-1.5 text-slate-900 font-semibold text-xs sm:text-sm">
            <Navigation className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
            <span>{facility.distance}</span>
          </div>
          <span className="w-px h-3.5 bg-slate-200" aria-hidden="true" />
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>{facility.estimatedTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
