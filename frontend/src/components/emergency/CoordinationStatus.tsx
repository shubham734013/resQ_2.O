import { LiveAmbulanceTracking } from '../LiveAmbulanceTracking';
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
  KeyRound,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Facility } from '../../types/facility';
import { emergencyApi } from '../../services/emergencyApi';

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
                      ? 'Sending your emergency request'
                      : 'Emergency request not sent';

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
    } catch {
      setCancelError('We could not cancel the emergency request. Try again.');
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
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300 bg-rose-500/15 px-3 py-1 rounded-full border border-rose-500/30">
              {statusLabel}
            </span>
          </div>
          <h2 className="mt-3 text-2xl md:text-3xl font-light text-zinc-100 tracking-tight">Emergency request</h2>
        </div>

        {/* Destination Card in Dark Glass */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 flex items-start justify-between gap-4 shadow-xl">
          <div className="min-w-0">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400 block mb-1">Hospital</span>
            <h3 className="font-bold text-white text-base sm:text-lg truncate">{facility.name}</h3>
            <p className="text-xs text-zinc-400 truncate mt-1">{facility.address || 'Address unavailable'}</p>
          </div>
          <div className="text-right shrink-0 bg-white/[0.04] border border-white/10 rounded-2xl px-3.5 py-2.5 shadow-md">
            <span className="font-mono font-bold text-white text-sm sm:text-base block">{facility.distance}</span>
            <span className="text-xs font-mono font-medium text-emerald-400 flex items-center gap-1 justify-end mt-1">
              <Clock className="w-3.5 h-3.5" />
              {facility.estimatedTime || 'Live ETA unavailable'}
            </span>
          </div>
        </div>

        {ready && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6 space-y-1.5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300">Hospital request number</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  ACTIVE QUEUE
                </span>
                {isCancellable && (
                  <button
                    type="button"
                    onClick={handleExitClick}
                    className="text-[11px] font-semibold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 px-2.5 py-0.5 rounded-md border border-rose-500/40 transition flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Cancel request</span>
                  </button>
                )}
              </div>
            </div>
            <p className="font-mono text-lg font-bold text-emerald-100 pt-1 tracking-wider">{data?.requestCode ?? emergencyRequestId}</p>
            <p className="text-xs text-zinc-400 leading-relaxed pt-1">
              Your request is in the hospital&apos;s list. The emergency team has been told and is checking what care is needed.
            </p>
          </div>
        )}

        {data?.pickupOtp && (
          <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-5 sm:p-6 space-y-3 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                Pickup Verification Code (OTP)
              </span>
              {data.pickupOtpVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  VERIFIED BY DRIVER
                </span>
              ) : (
                <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30">
                  AWAITING AMBULANCE ARRIVAL
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-[0.25em] text-white bg-black/50 px-5 py-2.5 rounded-xl border border-white/15 select-all shadow-inner">
                {data.pickupOtp}
              </div>
              <p className="text-xs text-indigo-200/90 max-w-xs font-light leading-relaxed">
                {data.pickupOtpVerified
                  ? 'The ambulance team confirmed your pickup. You are on your way to the hospital.'
                  : 'Give this 6-digit code to the ambulance driver when they arrive. This lets you get in.'}
              </p>
            </div>
          </div>
        )}

        {data?.dispatch && (
          <div role="status" className={`rounded-2xl border p-5 sm:p-6 space-y-2 backdrop-blur-xl ${data.dispatch.status === 'EXHAUSTED' || data.dispatch.status === 'ESCALATED' ? 'border-amber-500/30 bg-amber-500/10' : 'border-sky-500/30 bg-sky-500/10'}`}>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Ambulance request status</p>
            <p className="text-base font-bold text-white">
              {data.dispatch.status === 'OFFERED' ? 'The request was sent to a driver' :
                data.dispatch.status === 'ACCEPTED' ? 'A driver accepted your request' :
                  data.dispatch.status === 'EXHAUSTED' ? 'No nearby driver is free now' :
                    data.dispatch.status === 'ESCALATED' ? 'A dispatcher needs to help with this request' :
                      data.dispatch.status === 'CANCELLED' ? 'The ambulance request was canceled' :
                        data.dispatch.status === 'SEARCHING' ? 'Looking for an ambulance and driver' : 'Your ambulance request is waiting'}
            </p>
            <p className="text-xs text-zinc-400">{data.dispatch.message ?? `Search tries: ${data.dispatch.attemptCount}`}</p>
            {(data.dispatch.status === 'EXHAUSTED' || data.dispatch.status === 'ESCALATED') && (
              <div className="mt-3 flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { window.location.href = 'tel:112'; }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer transition"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call 112</span>
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-zinc-200 text-xs font-semibold border border-white/10 shadow-md cursor-pointer transition"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>Choose another hospital</span>
                </button>
                <span className="text-[11px] text-amber-300 font-medium w-full">Your request is open. You can also choose another nearby hospital.</span>
              </div>
            )}
          </div>
        )}

        {emergencyRequestId && <LiveAmbulanceTracking emergencyRequestId={emergencyRequestId} />}

        {error && (
          <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-xs text-amber-200 backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
        )}
        {request.isError && requestSubmitted && (
          <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 backdrop-blur-md">
            We could not load the latest status. Your request is still open.
            <button type="button" onClick={() => void request.refetch()} className="ml-2 font-semibold underline text-amber-100 cursor-pointer">Check again</button>
          </div>
        )}

        {/* Timeline Progression in Dark Glass */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 block border-b border-white/10 pb-3">
            Coordination Milestones
          </span>
          <ol className="space-y-4 text-xs">
            {[
              { label: 'Finding care', done: true },
              { label: 'Hospital chosen', done: true },
              {
                label: 'Send emergency request',
                done: ready,
                current: isCreatingRequest,
              },
              { label: 'Ready for directions', done: typeof facility.latitude === 'number' && typeof facility.longitude === 'number' },
            ].map((step, index) => (
              <li key={step.label} className="flex items-start gap-3.5">
                <div className="mt-0.5 shrink-0">
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : step.current ? (
                    <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                      {index + 1}
                    </div>
                  )}
                </div>
                <div>
                  <span className={`font-semibold block ${step.done ? 'text-white' : 'text-zinc-500'}`}>{step.label}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-zinc-400 flex items-start gap-3">
          <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-zinc-200">Important:</strong> ResQ can help you contact a hospital and find the way. The hospital decides if it can take you. Ambulance help depends on what local services can provide.
          </p>
        </div>
      </div>

      <div className="pt-6 sticky bottom-0 bg-[#070709]/85 backdrop-blur-xl py-4 border-t border-white/10 -mx-4 px-4 sm:mx-0 sm:px-0 space-y-3 z-20">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate(`/route/${facility.id}?emergency=true`)}
            disabled={!ready || typeof facility.latitude !== 'number' || typeof facility.longitude !== 'number'}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-950/60 transition cursor-pointer disabled:opacity-50"
          >
            <Navigation className="w-4 h-4" />
            <span>Start directions</span>
          </button>
          <button
            type="button"
            onClick={callHospital}
            disabled={!facility.phone}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 font-semibold text-sm transition cursor-pointer disabled:opacity-50"
          >
            <Phone className="w-4 h-4" />
            <span>Call the hospital</span>
          </button>
        </div>

        {isCancellable && (
          <button
            type="button"
            onClick={handleExitClick}
            disabled={isCancelling}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
          >
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>{isCancelling ? 'Cancelling Emergency Request…' : 'Cancel Emergency Request'}</span>
          </button>
        )}
        <div className="flex items-center justify-between text-xs pt-1 px-1">
          <button
            type="button"
            onClick={() => {
              window.location.href = 'tel:112';
            }}
            className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Call emergency services (112)</span>
          </button>
          <button
            type="button"
            onClick={handleExitClick}
            className="text-zinc-400 hover:text-zinc-200 font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Leave emergency help</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Exit / Cancel Coordination Modal in Dark Glass */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div role="dialog" aria-modal="true" className="w-full max-w-md bg-zinc-950/95 rounded-2xl shadow-2xl border border-white/10 overflow-hidden space-y-4 p-6 backdrop-blur-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Emergency request is open</h3>
                  <p className="text-xs font-mono text-zinc-400">Request number: {data?.requestCode ?? 'In progress'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Your emergency request is open with <strong className="text-white">{facility.name}</strong>. You can leave this page and keep the request open, or cancel it.
            </p>

            {cancelError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  onExit();
                }}
                className="w-full text-left p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition cursor-pointer"
              >
                <p className="text-xs font-bold text-white">Leave this page (keep request open)</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  The hospital remains alerted. You can monitor status anytime in your Profile.
                </p>
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="w-full text-left p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer"
              >
                <p className="text-xs font-bold text-rose-300 flex items-center gap-2">
                  {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Cancel emergency request
                </p>
                <p className="text-[11px] text-rose-300/70 mt-0.5">
                  Removes your request from the hospital queue and tells the dispatch team.
                </p>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                className="w-full py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] transition cursor-pointer"
                onClick={() => setShowExitModal(false)}
              >
                Stay on This Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
