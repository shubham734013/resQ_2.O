import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Navigation, Phone, ShieldAlert } from 'lucide-react';
import type { Facility } from '../../types/facility';
import { Button } from '../common/Button';
import { useRemoveSavedFacility, useSaveFacility, useSavedFacilities } from '../../hooks/useUser';

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
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setIsSaved(Boolean(saved.data?.items.some((item) => item.id === facility.id)));
  }, [facility.id, saved.data]);

  const handleDirections = () => {
    if (onDirections) { onDirections(); return; }
    navigate(`/route/${facility.id}${fromEmergency ? '?emergency=true' : ''}`);
  };
  const handleCall = () => {
    if (onCall) { onCall(); return; }
    window.location.href = `tel:${facility.phone.replace(/[^0-9+]/g, '')}`;
  };
  const toggleSaved = () => {
    if (isSaved) remove.mutate(facility.id, { onSuccess: () => setIsSaved(false) });
    else save.mutate(facility.id, { onSuccess: () => setIsSaved(true) });
  };

  return (
    <div className={`${isStickyBottom ? 'fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg md:relative md:border-0 md:bg-transparent md:p-0 md:shadow-none' : ''} ${className}`}>
      <div className="max-w-4xl mx-auto space-y-2">
        {fromEmergency && (
          <div className="p-3 bg-rose-50/90 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-950">
            <div className="flex items-center gap-1.5 font-semibold text-rose-900"><ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" /><span>Emergency Coordination Flow Active</span></div>
            <p className="text-[11px] text-rose-800 leading-relaxed">You selected this facility from the Emergency Flow. Lock in this facility to continue coordination.</p>
            <Button variant="emergency" size="sm" fullWidth onClick={() => navigate(`/sos?facility=${facility.id}`)} icon={<ShieldAlert className="w-3.5 h-3.5 text-white" />} aria-label={`Confirm emergency coordination with ${facility.name}`}>Continue Coordination with this Facility</Button>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="lg" icon={<Phone className="w-4 h-4" />} onClick={handleCall} aria-label={`Call ${facility.name} at ${facility.phone}`} className="flex-1">Call</Button>
          <Button variant="outline" size="lg" icon={isSaved ? <BookmarkCheck className="w-4 h-4"/> : <Bookmark className="w-4 h-4"/>} onClick={toggleSaved} disabled={save.isPending||remove.isPending} aria-label={isSaved ? `Remove ${facility.name} from saved facilities` : `Save ${facility.name}`}>{isSaved ? 'Saved' : 'Save'}</Button>
          <Button variant="primary" size="lg" icon={<Navigation className="w-4 h-4" />} onClick={handleDirections} aria-label={`Get directions to ${facility.name}`} className="flex-1">Get Directions</Button>
        </div>
      </div>
    </div>
  );
};