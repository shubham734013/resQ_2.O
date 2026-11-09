import {
  CheckCircle2,
  Building2,
  MapPin,
  ExternalLink,
  Flame,
  Home,
  Phone,
  Navigation,
} from 'lucide-react';
import type { Facility } from '../../types/facility';
import { Button } from '../common/Button';

export interface ArrivalStateProps {
  facility: Facility;
  isEmergency?: boolean;
  onViewFacility: () => void;
  onEndTrip: () => void;
  className?: string;
}

export const ArrivalState = ({
  facility,
  isEmergency = false,
  onViewFacility,
  onEndTrip,
  className = '',
}: ArrivalStateProps) => {
  const handleCall = () => {
    window.location.href = `tel:${facility.phone.replace(/[^0-9+]/g, '')}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrival-dialog-title"
      className={`bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 text-center max-w-lg w-full mx-auto ${className}`}
    >
      {/* Success Badge */}
      <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
        <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
      </div>

      {/* Arrival Header */}
      <div className="space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block">
          Destination Reached
        </span>
        <h2
          id="arrival-dialog-title"
          className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight"
        >
          You Have Arrived
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
          Welcome to <strong className="text-slate-900">{facility.name}</strong>.
        </p>
      </div>

      {/* Destination Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
              {facility.name}
            </h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{facility.address}</span>
            </p>
          </div>

          {facility.emergencyAvailable && (
            <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-600" />
              Emergency Intake
            </span>
          )}
        </div>

        {isEmergency ? (
          <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-lg text-xs text-rose-900 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium text-[11px]">
              Proceed directly to North Emergency Intake bay for emergency reception.
            </span>
          </div>
        ) : (
          <div className="p-2.5 bg-blue-50 border border-blue-200/80 rounded-lg text-xs text-blue-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-medium text-[11px]">
              Visitor and outpatient parking is available at the main facility parking deck.
            </span>
          </div>
        )}
      </div>

      {/* Primary Actions: View Facility Details & End Trip */}
      <div className="space-y-2 pt-1">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="lg"
            icon={<Phone className="w-4 h-4" />}
            onClick={handleCall}
            aria-label={`Call facility at ${facility.phone}`}
            className="flex-1"
          >
            Call Desk
          </Button>

          <Button
            variant="secondary"
            size="lg"
            icon={<ExternalLink className="w-4 h-4" />}
            onClick={onViewFacility}
            aria-label="View facility details"
            className="flex-1 font-semibold"
          >
            Facility Details
          </Button>
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon={<Home className="w-4 h-4" />}
          onClick={onEndTrip}
          aria-label="End trip and return to home"
          className="font-bold"
        >
          End Trip & Return Home
        </Button>
      </div>
    </div>
  );
};
