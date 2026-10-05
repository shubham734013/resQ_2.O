import { useParams, useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useFacility } from '../hooks/useFacility';
import { FacilityHeader } from '../components/facility/FacilityHeader';
import { FacilityStatus } from '../components/facility/FacilityStatus';
import { FacilityCapabilityList } from '../components/facility/FacilityCapabilityList';
import { FacilityContact } from '../components/facility/FacilityContact';
import { FacilityLocation } from '../components/facility/FacilityLocation';
import { FacilityActions } from '../components/facility/FacilityActions';
import { Button } from '../components/common/Button';
import type { UserLocation } from '../types/facility';

interface LayoutContext {
  currentLocation: UserLocation;
  refreshLocation: () => void;
  isUpdating: boolean;
}

export const FacilityDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromEmergency = searchParams.get('emergency') === 'true';

  const { currentLocation } = useOutletContext<LayoutContext>();
  const { facility, isLoading, isNotFound } = useFacility(id);

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
        <div className="h-8 w-24 bg-slate-200 rounded-md" />
        <div className="space-y-3">
          <div className="h-7 w-3/4 bg-slate-200 rounded-lg" />
          <div className="h-4 w-1/3 bg-slate-100 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="space-y-4">
            <div className="h-32 bg-slate-100 rounded-xl" />
            <div className="h-48 bg-slate-100 rounded-xl" />
          </div>
          <div className="h-72 bg-slate-100 rounded-xl" />
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          <span>Loading facility details...</span>
        </div>
      </div>
    );
  }

  // 2. Facility Not Found State
  if (isNotFound || !facility) {
    return (
      <div className="flex-1 max-w-lg w-full mx-auto p-6 sm:p-12 text-center space-y-4 my-auto">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">Facility Not Found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            The healthcare facility with identifier <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">{id}</code> could not be located in our verified directory.
          </p>
        </div>
        <div className="pt-2 flex justify-center gap-2">
          <Button
            variant="secondary"
            size="md"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/search')}
          >
            Back to Search
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/')}
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  // 3. Facility Found (Mobile, Tablet, and Desktop Layouts)
  return (
    <div className="flex-1 bg-slate-50 min-h-full">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 space-y-6">
        {/* Header: Back navigation, Title, Badges, Distance & ETA */}
        <FacilityHeader facility={facility} />

        {/* Two-Column Responsive Grid (Tablet & Desktop) / Single-Column (Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Information Hierarchy (Availability, Capabilities, Contact) */}
          <div className="md:col-span-7 lg:col-span-7 space-y-5">
            {/* 1. Operating & Intake Status */}
            <FacilityStatus facility={facility} />

            {/* 2. Clinical Capabilities & Departments */}
            <FacilityCapabilityList facility={facility} />

            {/* 3. Address & Contact Information */}
            <FacilityContact facility={facility} />

            {/* Inline Desktop Actions */}
            <div className="hidden md:block pt-2">
              <FacilityActions
                facility={facility}
                fromEmergency={fromEmergency}
              />
            </div>
          </div>

          {/* Right Column: Location Map & Route Summary */}
          <div className="md:col-span-5 lg:col-span-5 space-y-5 md:sticky md:top-20">
            <FacilityLocation
              facility={facility}
              userLocation={currentLocation}
            />

            {/* Medical Disclaimer Note */}
            <div className="p-3 bg-white border border-slate-200/80 rounded-xl text-[11px] text-slate-500 flex items-start gap-2 shadow-xs">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                ResQ provides facility navigation and logistical coordination. Emergency intake is subject to hospital triage criteria.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Actions Area */}
      <div className="md:hidden">
        <FacilityActions
          facility={facility}
          fromEmergency={fromEmergency}
          isStickyBottom
        />
      </div>
    </div>
  );
};
