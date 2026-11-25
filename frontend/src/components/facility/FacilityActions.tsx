import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Navigation, Phone, ShieldAlert, Building2, Calendar } from 'lucide-react';
import type { Facility } from '../../types/facility';
import { useRemoveSavedFacility, useSaveFacility, useSavedFacilities } from '../../hooks/useUser';
import { CareRequestModal } from './CareRequestModal';
import { AppointmentBookingModal } from './AppointmentBookingModal';

export interface FacilityActionsProps {
  facility: Facility;
  fromEmergency?: boolean;
  onDirections?: () => void;
  onCall?: () => void;
  isStickyBottom?: boolean;
  className?: string;
}

export const FacilityActions = ({
  facility,
  fromEmergency = false,
  onDirections,
  onCall,
  isStickyBottom = false,
  className = '',
}: FacilityActionsProps) => {
  const navigate = useNavigate();
  const saved = useSavedFacilities();
  const save = useSaveFacility();
  const remove = useRemoveSavedFacility();
  const isServerSaved = Boolean(saved.data?.items.some((item) => item.id === facility.id));
  const [overrideSaved, setOverrideSaved] = useState<boolean | null>(null);
  const isSaved = overrideSaved ?? isServerSaved;

  const [isCareRequestOpen, setIsCareRequestOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);

  const handleDirections = () => {
    if (onDirections) {
      onDirections();
      return;
    }
    navigate(`/user/route/${facility.id}${fromEmergency ? '?emergency=true' : ''}`);
  };

  const handleCall = () => {
    if (onCall) {
      onCall();
      return;
    }
    window.location.href = `tel:${facility.phone.replace(/[^0-9+]/g, '')}`;
  };

  const toggleSaved = () => {
    if (isSaved) {
      remove.mutate(facility.id, { onSuccess: () => setOverrideSaved(false) });
    } else {
      save.mutate(facility.id, { onSuccess: () => setOverrideSaved(true) });
    }
  };

  return (
    <>
      <div
        className={`${
          isStickyBottom
            ? 'fixed bottom-0 left-0 right-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl md:relative md:border-0 md:bg-transparent md:p-0 md:shadow-none'
            : ''
        } ${className}`}
      >
        <div className="max-w-4xl mx-auto space-y-3 font-sans">
          {fromEmergency && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2.5 text-xs text-rose-300 backdrop-blur-md shadow-xl">
              <div className="flex items-center gap-2 font-semibold text-rose-200">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Emergency Coordination Flow Active</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                You selected this facility from the Emergency Flow. Confirm coordination to lock in triage telemetry.
              </p>
              <button
                type="button"
                onClick={() => navigate(`/user/emergency?facility=${facility.id}`)}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-950/60 transition cursor-pointer"
              >
                Continue Coordination with this Facility
              </button>
            </div>
          )}

          {/* Primary Action Buttons for Non-Emergency Care & Appointments */}
          {!fromEmergency && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsCareRequestOpen(true)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 transition cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-rose-400" />
                <span>Request Care</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAppointmentOpen(true)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 transition cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Book Appointment</span>
              </button>
            </div>
          )}

          {/* Secondary Controls: Call, Save Bookmark, and Direction Navigation */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCall}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 transition cursor-pointer"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>Call</span>
            </button>

            <button
              type="button"
              onClick={toggleSaved}
              disabled={save.isPending || remove.isPending}
              className={`flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                isSaved
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300'
              }`}
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4 text-emerald-400" /> : <Bookmark className="w-4 h-4" />}
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>

            <button
              type="button"
              onClick={handleDirections}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-950/50 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              <span>Get Directions</span>
            </button>
          </div>
        </div>
      </div>

      {/* Direct Care Request Modal */}
      <CareRequestModal
        key={facility.id}
        facility={facility}
        isOpen={isCareRequestOpen}
        onClose={() => setIsCareRequestOpen(false)}
      />

      {/* Appointment Booking Modal */}
      <AppointmentBookingModal
        facility={facility}
        isOpen={isAppointmentOpen}
        onClose={() => setIsAppointmentOpen(false)}
      />
    </>
  );
};
