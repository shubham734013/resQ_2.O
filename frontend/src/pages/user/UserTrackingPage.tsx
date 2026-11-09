import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { LiveAmbulanceTracking } from '../../components/LiveAmbulanceTracking';
import { Button } from '../../components/common/Button';
import { ROUTES } from '../../routes/routePaths';

export const UserTrackingPage = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  if (!requestId) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <h2 className="text-lg font-bold text-slate-900">Tracking ID Required</h2>
        <p className="mt-2 text-sm text-slate-600">Select an active emergency request to view live ambulance telemetry.</p>
        <Link to={ROUTES.USER.EMERGENCY} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
          Return to Emergency
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(ROUTES.USER.DASHBOARD)}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Dashboard
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Live Ambulance Telemetry</h1>
            <p className="text-xs text-slate-500">Encrypted Satellite Tracking Session: {requestId}</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold">GPS Refresh: Real-time</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <LiveAmbulanceTracking emergencyRequestId={requestId} />
      </div>
    </div>
  );
};
