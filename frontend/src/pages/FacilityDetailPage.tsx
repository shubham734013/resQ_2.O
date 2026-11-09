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
import { useLocationState } from '../hooks/useLocationState';
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

  const outletContext = useOutletContext<LayoutContext | undefined>();
  const fallback = useLocationState();
  const currentLocation = outletContext?.currentLocation ?? fallback.currentLocation;
  const { facility, isLoading, isNotFound } = useFacility(id);

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse font-sans">
        <div className="h-9 w-28 bg-white/[0.04] border border-white/5 rounded-xl" />
        <div className="space-y-3">
          <div className="h-8 w-3/4 bg-white/[0.05] border border-white/5 rounded-xl" />
          <div className="h-4 w-1/3 bg-white/[0.03] rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="space-y-4">
            <div className="h-36 bg-white/[0.03] border border-white/10 rounded-2xl" />
            <div className="h-52 bg-white/[0.03] border border-white/10 rounded-2xl" />
          </div>
          <div className="h-80 bg-white/[0.03] border border-white/10 rounded-2xl" />
        </div>
        <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
          <span>Loading verified facility telemetry…</span>
        </div>
      </div>
    );
  }

  // 2. Facility Not Found State
  if (isNotFound || !facility) {
    return (
      <div className="flex-1 max-w-lg w-full mx-auto p-6 sm:p-12 text-center space-y-5 my-auto font-sans">
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-10 space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400 shadow-lg shadow-rose-950/40">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-light text-zinc-100 tracking-tight">Facility Not Found</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              The healthcare facility with identifier <code className="bg-white/[0.06] border border-white/10 px-1.5 py-0.5 rounded font-mono text-rose-300">{id}</code> could not be located in our directory.
            </p>
          </div>
          <div className="pt-3 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/user/hospitals')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-200 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Directory</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/user/dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-xs font-semibold text-white shadow-lg shadow-rose-950/50 transition cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Facility Found (Mobile, Tablet, and Desktop Layouts)
  return (
    <div className="flex-1 min-h-full font-sans text-zinc-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 space-y-6">
        {/* Header: Back navigation, Title, Badges, Distance & ETA */}
        <FacilityHeader facility={facility} />

        {/* Two-Column Responsive Grid */}
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
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-zinc-400 flex items-start gap-3 shadow-xl backdrop-blur-md">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                ResQ provides facility navigation and logistical coordination. Emergency intake is subject to live hospital triage protocol and bed availability.
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
