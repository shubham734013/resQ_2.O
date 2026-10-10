import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Navigation,
  Phone,
  ShieldAlert,
  ArrowRight,
  Info,
  Loader2,
  AlertTriangle,
  X,
  AlertOctagon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Facility } from '../../types/facility';
import { emergencyApi } from '../../services/emergencyApi';
import { Button } from '../common/Button';

export interface CoordinationStatusProps {
  facility: Facility;
  onExit: () => void;
  emergencyRequestId?: string | null;
  isCreatingRequest?: boolean;
  error?: string | null;
  className?: string;
}

export const CoordinationStatus = ({
  facility,
  onExit,
  emergencyRequestId,
  isCreatingRequest = false,
  error,
  className = '',
}: CoordinationStatusProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showExitModal, setShowExitModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const request = useQuery({
    queryKey: ['emergency-request', emergencyRequestId],
    queryFn: () => emergencyApi.get(emergencyRequestId as string),
    enabled: Boolean(emergencyRequestId),
    refetchInterval: 5000,
  });

  const data = request.data;
  const requestSubmitted = Boolean(emergencyRequestId);
  const ready = Boolean(data) || requestSubmitted;
  const isCancellable =
    ready &&
    data?.status &&
    ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(data.status);

  const statusLabel =
    data?.status === 'AMBULANCE_COORDINATION'
      ? 'Ambulance coordination'
      : data?.status === 'PREPARING'
        ? 'Hospital preparing'
        : data?.status === 'REVIEWING'
          ? 'Hospital reviewing'
          : data?.status === 'RESOLVED'
            ? 'Resolved'
            : data?.status === 'CANCELLED'
              ? 'Cancelled'
              : requestSubmitted && request.isError
                ? 'Request saved · status unavailable'
                : requestSubmitted && request.isLoading
                  ? 'Request saved · loading status'
                  : ready
                    ? 'Received by hospital queue'
                    : isCreatingRequest
                      ? 'Creating emergency request'
                      : 'Emergency request not created';

  const callHospital = () => {
    if (facility.phone) window.location.href = `tel:${facility.phone.replace(/[^0-9+]/g, '')}`;
  };

  const handleExitClick = () => {
    if (!emergencyRequestId || !isCancellable) {
      onExit();
      return;
    }
    setShowExitModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!emergencyRequestId) {
      onExit();
      return;
    }
    setIsCancelling(true);
    setCancelError(null);
    try {
      await emergencyApi.cancel(emergencyRequestId);
      await queryClient.invalidateQueries({ queryKey: ['emergency-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['user', 'emergencies'] });
      await queryClient.invalidateQueries({ queryKey: ['emergency-request', emergencyRequestId] });
      setShowExitModal(false);
      onExit();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Could not cancel emergency request.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className={`space-y-6 flex-1 flex flex-col justify-between ${className}`}>
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${ready && !request.isError ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {statusLabel}
            </span>
          </div>
          <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-950">Emergency coordination</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Selected facility: <strong className="text-slate-800">{facility.name}</strong>.
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Destination</span>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">{facility.name}</h3>
            <p className="text-xs text-slate-500 truncate">{facility.address || 'Address unavailable'}</p>
          </div>
          <div className="text-right shrink-0 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
            <span className="font-bold text-slate-900 text-xs sm:text-sm block">{facility.distance}</span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" />
              {facility.estimatedTime || 'Live ETA unavailable'}
            </span>
          </div>
        </div>

        {ready && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">ResQ request</p>
            <p className="mt-1 font-bold text-emerald-950">{data?.requestCode ?? emergencyRequestId}</p>
            <p className="mt-1 text-xs text-emerald-800">
              Persisted in the selected hospital&apos;s emergency queue. Hospital response controls the next coordination step.
            </p>
            <p className="mt-1 text-[11px] text-emerald-800">Request ID: {data?.id ?? emergencyRequestId}</p>
          </div>
        )}
        {data?.dispatch && (
          <div role="status" className={`rounded-xl border p-4 ${data.dispatch.status === 'EXHAUSTED' || data.dispatch.status === 'ESCALATED' ? 'border-amber-300 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Ambulance dispatch</p>
            <p className="mt-1 text-sm font-bold text-slate-950">
              {data.dispatch.status === 'OFFERED' ? 'A driver is being offered this request' :
                data.dispatch.status === 'ACCEPTED' ? 'A driver accepted the request' :
                  data.dispatch.status === 'EXHAUSTED' ? 'No eligible driver is currently available' :
                    data.dispatch.status === 'ESCALATED' ? 'Dispatch escalated for manual intervention' :
                      data.dispatch.status === 'CANCELLED' ? 'Dispatch cancelled' :
                        data.dispatch.status === 'SEARCHING' ? 'Searching eligible drivers and ambulances' : 'Dispatch queued'}
            </p>
            <p className="mt-1 text-xs text-slate-700">{data.dispatch.message ?? `Dispatch attempts: ${data.dispatch.attemptCount}`}</p>
            {(data.dispatch.status === 'EXHAUSTED' || data.dispatch.status === 'ESCALATED') && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="emergency" size="sm" onClick={() => { window.location.href = 'tel:112'; }} icon={<Phone className="h-3.5 w-3.5" />}>Call 112</Button>
                <span className="text-[11px] text-amber-900">Keep your phone available. Hospital selection remains unchanged.</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
            <span>{error}</span>
          </div>
        )}
        {request.isError && requestSubmitted && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            The request ID is retained, but its latest status could not be loaded. Your request has not been cancelled.
            <button type="button" onClick={() => void request.refetch()} className="ml-2 font-semibold underline">Retry status</button>
          </div>
        )}

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block border-b border-slate-100 pb-2">
            Coordination status
          </span>
          <ol className="space-y-3 text-xs">
            {[
              { label: 'Finding care', detail: 'Verified facilities ranked from the confirmed location.', done: true },
              { label: 'Facility selected', detail: 'Destination selected from the verified facility directory.', done: true },
              {
                label: 'Emergency request',
                detail: ready ? 'Request persisted to hospital operations.' : 'Waiting for request persistence.',
                done: ready,
                current: isCreatingRequest,
              },
              { label: 'Ready for navigation', detail: typeof facility.latitude === 'number' && typeof facility.longitude === 'number' ? 'Hospital coordinates are available for navigation.' : 'Hospital coordinates are not currently available.', done: typeof facility.latitude === 'number' && typeof facility.longitude === 'number' },
            ].map((step, index) => (
              <li key={step.label} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : step.current ? (
                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                      {index + 1}
                    </div>
                  )}
                </div>
                <div>
                  <span className={`font-semibold block ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</span>
                  <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">{step.detail}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-3 bg-slate-100 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Important:</strong> ResQ coordinates navigation and request delivery. Hospital triage and ambulance availability remain subject to live provider decisions.
          </p>
        </div>
      </div>

      <div className="pt-4 sticky bottom-0 bg-slate-50/95 backdrop-blur-xs py-3 border-t border-slate-200/80 -mx-4 px-4 sm:mx-0 sm:px-0 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Button
            variant="primary"
            size="lg"
            icon={<Navigation className="w-4 h-4" />}
            onClick={() => navigate(`/route/${facility.id}?emergency=true`)}
            className="flex-1 font-bold"
            disabled={!ready || typeof facility.latitude !== 'number' || typeof facility.longitude !== 'number'}
          >
            Start Navigation
          </Button>
          <Button variant="secondary" size="lg" icon={<Phone className="w-4 h-4" />} onClick={callHospital} className="flex-1" disabled={!facility.phone}>
            Call Hospital
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs pt-1 px-1">
          <button
            type="button"
            onClick={() => {
              window.location.href = 'tel:112';
            }}
            className="text-rose-700 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Direct emergency dial
          </button>
          <button
            type="button"
            onClick={handleExitClick}
            className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>Exit Emergency Flow</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Phase 9: Exit / Cancel Coordination Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden space-y-4 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Emergency Coordination Active</h3>
                  <p className="text-xs text-slate-500">Request code: {data?.requestCode ?? 'In progress'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your emergency coordination is currently active with <strong>{facility.name}</strong>. Choose whether to leave this screen while keeping coordination active, or cancel the request entirely.
            </p>

            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  onExit();
                }}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                <p className="text-xs font-bold text-slate-900">Leave Screen (Keep Active)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  The hospital remains alerted. You can monitor status anytime in your Profile.
                </p>
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="w-full text-left p-3 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-50 transition cursor-pointer"
              >
                <p className="text-xs font-bold text-rose-700 flex items-center gap-2">
                  {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Cancel Emergency Coordination
                </p>
                <p className="text-[11px] text-rose-600/80 mt-0.5">
                  Releases the hospital queue slot and notifies coordinating dispatchers.
                </p>
              </button>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowExitModal(false)}
              >
                Stay on This Screen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};