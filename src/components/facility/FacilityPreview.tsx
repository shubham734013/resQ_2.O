import { motion, useReducedMotion } from 'framer-motion';
import {
  Navigation,
  Clock,
  Phone,
  CheckCircle2,
  X,
  Share2,
  Info,
} from 'lucide-react';
import type { Facility } from '../../types/facility';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { useNavigate } from 'react-router-dom';

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
    navigate(`/route/${facility.id}`);
  };

  const handleCall = () => {
    window.location.href = `tel:${facility.phone.replace(/[^0-9+]/g, '')}`;
  };

  const handleOpenDetails = () => {
    if (onViewDetails) {
      onViewDetails(facility);
    } else {
      navigate(`/facility/${facility.id}`);
    }
  };

  return (
    <motion.section
        aria-label={`Selected facility: ${facility.name}`}
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={`bg-white border border-slate-200/90 rounded-xl p-4 text-left shadow-sm ${
          isFloating ? 'shadow-lg ring-1 ring-slate-900/10' : ''
        } ${className}`}
      >
        {/* Mobile Pull/Dismiss Indicator if floating bottom sheet */}
        {isFloating && (
          <div className="flex justify-center -mt-2 mb-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss facility preview"
              className="w-10 h-1 rounded-full bg-slate-300 hover:bg-slate-400 cursor-pointer"
            />
          </div>
        )}

        {/* Top Header: Category & Badges & Dismiss Action */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {facility.emergencyAvailable ? (
              <StatusBadge variant="emergency" label="Emergency available" />
            ) : (
              <StatusBadge variant="urgent" label="Urgent Care Services" />
            )}
            {facility.verified && <StatusBadge variant="verified" label="Verified" />}
            {facility.openStatus && (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                {facility.openStatus}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <IconButton
              icon={<Share2 className="w-3.5 h-3.5" />}
              size="sm"
              variant="ghost"
              aria-label="Share facility information"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: facility.name,
                    text: `${facility.name} - ${facility.address} (${facility.phone})`,
                    url: window.location.href,
                  }).catch(() => {});
                }
              }}
            />
            {onClose && (
              <IconButton
                icon={<X className="w-4 h-4" />}
                size="sm"
                variant="ghost"
                aria-label="Dismiss facility preview"
                onClick={onClose}
              />
            )}
          </div>
        </div>

        {/* Title & Proximity ETA */}
        <div className="mt-2.5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 text-base md:text-lg leading-tight truncate">
              {facility.name}
            </h3>
            <p className="text-xs text-slate-500 mt-1 truncate">{facility.address}</p>
          </div>

          <div className="text-right shrink-0 bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center gap-1 text-slate-900 font-semibold text-xs md:text-sm justify-end">
              <Navigation className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
              <span>{facility.distance}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-600 justify-end mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>{facility.estimatedTime}</span>
            </div>
          </div>
        </div>

        {/* Capabilities Pills Preview */}
        {facility.capabilities && facility.capabilities.length > 0 && (
          <div className="mt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">
              Capabilities & Triage
            </span>
            <div className="flex flex-wrap gap-1.5">
              {facility.triageWaitTime && (
                <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded">
                  <Clock className="w-3 h-3 mr-1 text-amber-600" aria-hidden="true" />
                  {facility.triageWaitTime}
                </span>
              )}
              {facility.capabilities.slice(0, 3).map((cap) => (
                <span
                  key={cap}
                  className="inline-flex items-center text-xs text-slate-600 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1 text-slate-400" aria-hidden="true" />
                  {cap}
                </span>
              ))}
              {facility.capabilities.length > 3 && (
                <button
                  type="button"
                  onClick={handleOpenDetails}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium px-1 cursor-pointer self-center"
                >
                  +{facility.capabilities.length - 3} more
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Info & Explicit Actions ("View details", "Directions", "Call") */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-[11px] text-slate-600 flex items-center gap-2">
            <span>Updated {facility.lastUpdated}</span>
            <span>•</span>
            <span className="font-mono text-slate-500">{facility.phone}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              icon={<Phone className="w-3.5 h-3.5" />}
              onClick={handleCall}
              aria-label={`Call ${facility.name} at ${facility.phone}`}
              className="flex-1 sm:flex-initial"
            >
              Call
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Info className="w-3.5 h-3.5" />}
              onClick={handleOpenDetails}
              aria-label={`View details for ${facility.name}`}
              className="flex-1 sm:flex-initial"
            >
              View details
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Navigation className="w-3.5 h-3.5" />}
              onClick={handleDirections}
              aria-label={`Directions to ${facility.name}`}
              className="flex-1 sm:flex-initial"
            >
              Directions
            </Button>
          </div>
        </div>
      </motion.section>
  );
};
