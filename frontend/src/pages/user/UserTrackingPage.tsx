import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, XCircle, AlertTriangle } from 'lucide-react';
import { LiveAmbulanceTracking } from '../../components/LiveAmbulanceTracking';
import { Button } from '../../components/common/Button';
import { ROUTES } from '../../routes/routePaths';
import { emergencyApi } from '../../services/emergencyApi';

export const UserTrackingPage = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancelRequest = async () => {
    if (!requestId) return;
    if (!window.confirm('Cancel this emergency request?')) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await emergencyApi.cancel(requestId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['emergency-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['user', 'emergencies'] }),
        queryClient.invalidateQueries({ queryKey: ['tracking', 'emergency', requestId] }),
      ]);
      navigate(ROUTES.USER.DASHBOARD);
    } catch {
      setCancelError('We could not cancel the emergency request. Try again.');
      setIsCancelling(false);
    }
  };

  if (!requestId) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <h2 className="text-lg font-bold text-slate-900">Choose an emergency request</h2>
        <p className="mt-2 text-sm text-slate-600">Choose an open request to see ambulance updates.</p>
        <Link to={ROUTES.USER.EMERGENCY} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
          Return to Emergency
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Ambulance updates</h1>
            <p className="text-xs text-slate-500">Encrypted Satellite Tracking Session: {requestId}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleCancelRequest}
            disabled={isCancelling}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <XCircle className="h-4 w-4 text-rose-600" />
            <span>{isCancelling ? 'Cancelling…' : 'Cancel Request'}</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">Location updates: Live</span>
          </div>
        </div>
      </div>

      {cancelError && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{cancelError}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <LiveAmbulanceTracking emergencyRequestId={requestId} />
      </div>
    </div>
  );
};
