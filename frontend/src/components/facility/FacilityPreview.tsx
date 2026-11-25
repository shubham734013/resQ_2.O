import { motion, useReducedMotion } from 'framer-motion';
import {
  Navigation,
  Clock,
  Phone,
  CheckCircle2,
  X,
  Share2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { Facility } from '../../types/facility';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';

export interface FacilityPreviewProps {
  facility: Facility | null;
  onClose?: () => void;
  onViewDetails?: (facility: Facility) => void;
  onDirections?: (facility: Facility) => void;
  className?: string;
  isFloating?: boolean;
}

export const FacilityPreview = ({
  facility,
  onClose,
  onViewDetails,
  onDirections,
  className = '',
  isFloating = false,
}: FacilityPreviewProps) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  if (!facility) return null;

  const handleDirections = () => {
    if (onDirections) {
      onDirections(facility);
      return;
    }
    navigate(ROUTES.USER.ROUTE_DETAIL(facility.id));
  };

  const handleCall = () => {
    window.location.href = `tel:${facility.phone.replace(/[^0-9+]/g, '')}`;
  };

  const handleOpenDetails = () => {
    if (onViewDetails) {
      onViewDetails(facility);
    } else {
      navigate(ROUTES.USER.HOSPITAL_DETAIL(facility.id));
    }
  };

  return (
    <motion.section
      aria-label={`Selected facility: ${facility.name}`}
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-5 text-left shadow-2xl space-y-4 ${
        isFloating ? 'shadow-rose-950/20 ring-1 ring-white/10' : ''
      } ${className}`}
    >
      {/* Mobile Pull/Dismiss Indicator if floating bottom sheet */}
      {isFloating && (
        <div className="flex justify-center -mt-2 mb-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss facility preview"
            className="w-12 h-1 rounded-full bg-white/20 hover:bg-white/40 cursor-pointer"
          />
        </div>
      )}

      {/* Top Header: Category & Badges & Dismiss Action */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {facility.emergencyAvailable ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span>24/7 Emergency</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
              <span>Urgent Care Services</span>
            </span>
          )}
          {facility.verified && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Verified</span>
            </span>
          )}
          {facility.openStatus && (
            <span className="text-xs font-medium text-zinc-300 bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/10">
              {facility.openStatus}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({
                    title: facility.name,
                    text: `${facility.name} - ${facility.address} (${facility.phone})`,
                    url: window.location.href,
                  })
                  .catch(() => {});
              }
            }}
            aria-label="Share facility information"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss facility preview"
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Title & Proximity ETA */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-light text-zinc-100 text-lg md:text-xl tracking-tight truncate">
            {facility.name}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 truncate">{facility.address}</p>
        </div>

        <div className="text-right shrink-0 bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-1.5 shadow-md">
          <div className="flex items-center gap-1 text-zinc-200 font-mono font-bold text-xs justify-end">
            <Navigation className="w-3 h-3 text-rose-400" aria-hidden="true" />
            <span>{facility.distance}</span>
          </div>
          {facility.estimatedTime && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 justify-end mt-0.5">
              <Clock className="w-3 h-3 text-zinc-500" aria-hidden="true" />
              <span>{facility.estimatedTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* Capabilities Pills Preview */}
      {facility.capabilities && facility.capabilities.length > 0 && (
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-2">
            Capabilities & Triage
          </span>
          <div className="flex flex-wrap gap-1.5">
            {facility.triageWaitTime && (
              <span className="inline-flex items-center text-xs font-mono font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                <Clock className="w-3 h-3 mr-1 text-amber-400" aria-hidden="true" />
                {facility.triageWaitTime} wait
              </span>
            )}
            {facility.capabilities.slice(0, 3).map((cap) => (
              <span
                key={cap}
                className="inline-flex items-center text-xs text-zinc-300 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-lg"
              >
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" aria-hidden="true" />
                {cap}
              </span>
            ))}
            {facility.capabilities.length > 3 && (
              <button
                type="button"
                onClick={handleOpenDetails}
                className="text-xs text-rose-400 hover:text-rose-300 font-mono px-1 cursor-pointer self-center"
              >
                +{facility.capabilities.length - 3} more
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer Info & Explicit Actions */}
      <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-2">
          <span>Updated {facility.lastUpdated}</span>
          <span>•</span>
          <span className="text-zinc-400">{facility.phone}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={handleCall}
            aria-label={`Call ${facility.name} at ${facility.phone}`}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5 text-zinc-400" />
            <span>Call</span>
          </button>

          <button
            type="button"
            onClick={handleOpenDetails}
            aria-label={`View details for ${facility.name}`}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-rose-400 hover:text-rose-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDirections}
            aria-label={`Directions to ${facility.name}`}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Directions</span>
          </button>
        </div>
      </div>
    </motion.section>
  );
};
