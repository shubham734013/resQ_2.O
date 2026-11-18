import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Building2,
  Clock,
  Phone,
  Search,
  Bell,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  HeartHandshake,
} from 'lucide-react';
import { useMyAppointments, useCancelAppointment } from '../hooks/useHospitalAppointments';
import { useMyCareRequests, useCancelCareRequest } from '../hooks/useHospitalCareRequests';
import { hospitalCareNotificationApi } from '../services/hospitalCareNotificationApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppointmentStatus } from '../services/hospitalAppointmentApi';
import type { CareRequestStatus } from '../services/hospitalCareRequestApi';
import { ROUTES } from '../routes/routePaths';

export interface CitizenAppointmentsPageProps {
  initialTab?: 'appointments' | 'requests' | 'notifications';
}

export const CitizenAppointmentsPage = ({
  initialTab = 'appointments',
}: CitizenAppointmentsPageProps = {}) => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  const [activeTab, setActiveTab] = useState<'appointments' | 'requests' | 'notifications'>(initialTab);

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [requestStatusFilter, setRequestStatusFilter] = useState<CareRequestStatus | 'ALL'>('ALL');

  // Queries
  const appointmentsQuery = useMyAppointments({
    status: appointmentStatusFilter === 'ALL' ? undefined : appointmentStatusFilter,
  });

  const careRequestsQuery = useMyCareRequests({
    status: requestStatusFilter === 'ALL' ? undefined : requestStatusFilter,
  });

  const notificationsQuery = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => hospitalCareNotificationApi.listUserNotifications(),
  });

  // Mutations
  const cancelAppointmentMutation = useCancelAppointment();
  const cancelCareRequestMutation = useCancelCareRequest();

  const markReadMutation = useMutation({
    mutationFn: (id: string) => hospitalCareNotificationApi.markUserNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-notifications'] });
    },
  });

  const handleCancelAppointment = (id: string) => {
    if (window.confirm('Are you sure you want to cancel this appointment? This will release your reserved slot.')) {
      cancelAppointmentMutation.mutate({ id, reason: 'Cancelled by patient' });
    }
  };

  const handleCancelCareRequest = (id: string) => {
    if (window.confirm('Are you sure you want to cancel this care request?')) {
      cancelCareRequestMutation.mutate({ id, reason: 'Cancelled by patient' });
    }
  };

  const handleTabChange = (tab: 'appointments' | 'requests' | 'notifications') => {
    setActiveTab(tab);
    if (tab === 'appointments') navigate(ROUTES.USER.APPOINTMENTS);
    else if (tab === 'requests') navigate(ROUTES.USER.REQUESTS);
    else if (tab === 'notifications') navigate(ROUTES.USER.NOTIFICATIONS);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>{status}</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>PENDING</span>
          </span>
        );
      case 'ALTERNATIVE_PROPOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shadow-xs">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>TIME PROPOSED</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-blue-400" />
            <span>COMPLETED</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-white/[0.04] text-zinc-400 border border-white/10 shadow-xs">
            <span>CANCELLED</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-xs">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>DECLINED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-white/[0.04] text-zinc-300 border border-white/10">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="relative flex-1 min-h-screen bg-[#070709] text-zinc-100 font-sans selection:bg-rose-500/20 selection:text-rose-200 py-8 px-4 sm:px-6 lg:px-10 overflow-hidden">
      {/* ─── 1. Ambient Background Radiant Glows ──────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-32 left-1/3 h-[500px] w-[500px] rounded-full opacity-[0.07] blur-[150px]"
          style={{ background: 'radial-gradient(circle, #f43f5e 0%, #f59e0b 50%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 right-1/4 h-[500px] w-[500px] rounded-full opacity-[0.05] blur-[160px]"
          style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto space-y-8">
        {/* ─── 2. Brand Header & Quick Action ───────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs font-mono font-medium text-teal-300 mb-3 shadow-xs">
              <HeartHandshake className="w-3.5 h-3.5 text-teal-400" />
              <span>Patient Coordination Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-zinc-100">
              Hospital Requests & Appointments
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed font-light">
              Manage your direct hospital consultations, reserved time windows, and clinical provider responses.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(ROUTES.USER.HOSPITALS)}
            className="self-start sm:self-auto px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 text-zinc-100 font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm group"
          >
            <Search className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
            <span>Find Hospitals</span>
          </button>
        </div>

        {/* ─── 3. Main Section Tabs ─────────────────────────────────────────── */}
        <div className="bg-white/[0.03] border border-white/10 p-1.5 rounded-2xl flex flex-wrap gap-2 max-w-xl backdrop-blur-md shadow-lg">
          <button
            type="button"
            onClick={() => handleTabChange('appointments')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'appointments'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Appointments</span>
            {Boolean(appointmentsQuery.data?.pagination.total) && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {appointmentsQuery.data?.pagination.total}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('requests')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Direct Care Requests</span>
            {Boolean(careRequestsQuery.data?.pagination.total) && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {careRequestsQuery.data?.pagination.total}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('notifications')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
            {Boolean(notificationsQuery.data?.items.filter((n) => n.status === 'UNREAD').length) && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-600 text-white shadow-xs animate-pulse">
                {notificationsQuery.data?.items.filter((n) => n.status === 'UNREAD').length}
              </span>
            )}
          </button>
        </div>

        {/* ─── TAB 1: APPOINTMENTS ──────────────────────────────────────────── */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            {/* Status Filter Micro-Pills */}
            <div className="flex flex-wrap items-center gap-2 py-1">
              {(
                [
                  { id: 'ALL', label: 'ALL' },
                  { id: 'PENDING', label: 'PENDING' },
                  { id: 'CONFIRMED', label: 'CONFIRMED' },
                  { id: 'ALTERNATIVE_PROPOSED', label: 'TIME PROPOSED' },
                  { id: 'COMPLETED', label: 'COMPLETED' },
                  { id: 'CANCELLED', label: 'CANCELLED' },
                ] as const
              ).map((st) => {
                const isActive = appointmentStatusFilter === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setAppointmentStatusFilter(st.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-mono tracking-wider transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-rose-500/10 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] font-semibold'
                        : 'bg-white/[0.04] border border-white/10 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>

            {/* Loading State */}
            {appointmentsQuery.isLoading ? (
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-16 text-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" />
                <p className="text-xs font-mono text-zinc-400">Loading scheduled doctor appointments…</p>
              </div>
            ) : appointmentsQuery.data?.items.length === 0 ? (
              /* Empty State */
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-10 md:p-14 text-center space-y-6 shadow-2xl">
                <div className="bg-rose-500/10 text-rose-400 p-5 rounded-2xl border border-rose-500/20 inline-flex shadow-inner">
                  <Calendar className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-light text-zinc-100 tracking-tight">No appointments found</h3>
                  <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed font-light">
                    You have no scheduled clinical consultations matching this status filter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.USER.HOSPITALS)}
                  className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-medium text-xs rounded-xl px-6 py-3 shadow-lg shadow-rose-950/40 hover:scale-[1.01] active:scale-[0.99] transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Browse Healthcare Facilities</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Data Rows */
              <div className="grid gap-4">
                {appointmentsQuery.data?.items.map((appt) => {
                  const hospital = typeof appt.hospitalId === 'object' ? appt.hospitalId : null;
                  const canCancel = ['PENDING', 'CONFIRMED', 'ALTERNATIVE_PROPOSED'].includes(appt.status);

                  return (
                    <article
                      key={appt._id}
                      className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 space-y-4 shadow-xl"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-white/[0.08] pb-4">
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="font-light text-zinc-100 text-base md:text-lg tracking-tight">
                              {hospital?.name ?? 'Healthcare Facility'}
                            </h3>
                            {getStatusBadge(appt.status)}
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 font-light">
                            {appt.serviceDepartment} Department
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="text-xs font-mono bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-lg text-zinc-300">
                            {appt.appointmentCode}
                          </span>
                        </div>
                      </div>

                      {/* Date & Time details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-xl text-xs">
                        <div className="flex items-center gap-2.5 text-zinc-300">
                          <Calendar className="w-4 h-4 text-rose-400 shrink-0" />
                          <div>
                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Date</p>
                            <p className="font-semibold text-zinc-200 mt-0.5">{appt.slotDate}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 text-zinc-300">
                          <Clock className="w-4 h-4 text-rose-400 shrink-0" />
                          <div>
                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Time Window</p>
                            <p className="font-semibold text-zinc-200 mt-0.5">
                              {appt.startTime} – {appt.endTime} ({appt.slotDurationMinutes} min)
                            </p>
                          </div>
                        </div>

                        {hospital?.phone && (
                          <div className="flex items-center gap-2.5 text-zinc-300">
                            <Phone className="w-4 h-4 text-rose-400 shrink-0" />
                            <div>
                              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Hospital Desk</p>
                              <a
                                href={`tel:${hospital.phone}`}
                                className="font-semibold text-rose-400 hover:text-rose-300 underline mt-0.5 block"
                              >
                                {hospital.phone}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reason & Hospital Notes */}
                      <div className="space-y-1.5 text-xs text-zinc-300">
                        <p>
                          <span className="font-mono text-zinc-500 uppercase tracking-wider text-[10px] mr-1.5">Visit Reason:</span>
                          <span className="text-zinc-200">{appt.visitReason}</span>
                        </p>
                        {appt.notes && (
                          <p>
                            <span className="font-mono text-zinc-500 uppercase tracking-wider text-[10px] mr-1.5">Instructions:</span>
                            <span className="text-zinc-300 font-light">{appt.notes}</span>
                          </p>
                        )}
                        {appt.rejectionReason && (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
                            <span className="font-semibold block mb-0.5">Reason for Decline:</span>
                            <span className="font-light">{appt.rejectionReason}</span>
                          </div>
                        )}
                      </div>

                      {/* Alternative Proposal Callout */}
                      {appt.status === 'ALTERNATIVE_PROPOSED' && appt.alternativeSlot && (
                        <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-2 text-xs text-indigo-200">
                          <div className="flex items-center gap-2 font-semibold text-indigo-300">
                            <Clock className="w-4 h-4 text-indigo-400" />
                            <span>Hospital Proposed an Alternative Slot:</span>
                          </div>
                          <p className="text-indigo-100 font-light">
                            <strong className="font-semibold text-white">{appt.alternativeSlot.date}</strong> at{' '}
                            <strong className="font-semibold text-white">{appt.alternativeSlot.startTime}</strong>
                            {appt.alternativeSlot.notes ? ` — "${appt.alternativeSlot.notes}"` : ''}
                          </p>
                          <p className="text-[11px] text-indigo-300/80 font-mono">
                            Please call {hospital?.phone ?? 'the facility desk'} to confirm or adjust your booking.
                          </p>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                        <span className="text-[11px] font-mono text-zinc-500">
                          Booked on {new Date(appt.createdAt).toLocaleDateString()}
                        </span>
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancelAppointment(appt._id)}
                            disabled={cancelAppointmentMutation.isPending}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                          >
                            Cancel Appointment
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: DIRECT CARE REQUESTS ──────────────────────────────────── */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            {/* Status Filter Micro-Pills */}
            <div className="flex flex-wrap items-center gap-2 py-1">
              {(
                [
                  { id: 'ALL', label: 'ALL' },
                  { id: 'PENDING', label: 'PENDING' },
                  { id: 'ACCEPTED', label: 'ACCEPTED' },
                  { id: 'REJECTED', label: 'DECLINED' },
                  { id: 'CANCELLED', label: 'CANCELLED' },
                ] as const
              ).map((st) => {
                const isActive = requestStatusFilter === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setRequestStatusFilter(st.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-mono tracking-wider transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-rose-500/10 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] font-semibold'
                        : 'bg-white/[0.04] border border-white/10 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>

            {/* Loading State */}
            {careRequestsQuery.isLoading ? (
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-16 text-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500 mx-auto" />
                <p className="text-xs font-mono text-zinc-400">Loading direct care requests…</p>
              </div>
            ) : careRequestsQuery.data?.items.length === 0 ? (
              /* Empty State */
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-10 md:p-14 text-center space-y-6 shadow-2xl">
                <div className="bg-rose-500/10 text-rose-400 p-5 rounded-2xl border border-rose-500/20 inline-flex shadow-inner">
                  <Building2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-light text-zinc-100 tracking-tight">No care requests found</h3>
                  <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed font-light">
                    You haven't submitted any direct care requests matching this status filter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.USER.HOSPITALS)}
                  className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-medium text-xs rounded-xl px-6 py-3 shadow-lg shadow-rose-950/40 hover:scale-[1.01] active:scale-[0.99] transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Browse Healthcare Facilities</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Data Rows */
              <div className="grid gap-4">
                {careRequestsQuery.data?.items.map((req) => {
                  const hospital = typeof req.hospitalId === 'object' ? req.hospitalId : null;
                  const canCancel = req.status === 'PENDING';

                  return (
                    <article
                      key={req._id}
                      className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 space-y-4 shadow-xl"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-white/[0.08] pb-4">
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="font-light text-zinc-100 text-base md:text-lg tracking-tight">
                              {hospital?.name ?? 'Healthcare Facility'}
                            </h3>
                            {getStatusBadge(req.status)}
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 font-light">
                            {req.serviceDepartment} · {req.requestType.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="text-xs font-mono bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-lg text-zinc-300">
                            {req.referenceId}
                          </span>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                        <div>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-0.5">
                            Timing Preference
                          </span>
                          <span className="font-medium text-zinc-200">{req.preferredTiming}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-0.5">
                            Contact Preference
                          </span>
                          <span className="font-medium text-zinc-200">{req.contactPreference}</span>
                        </div>
                      </div>

                      {/* Reason & Hospital response */}
                      <div className="space-y-2 text-xs text-zinc-300">
                        <p>
                          <span className="font-mono text-zinc-500 uppercase tracking-wider text-[10px] mr-1.5">Reason:</span>
                          <span className="text-zinc-200">{req.visitReason}</span>
                        </p>
                        {req.hospitalResponse?.notes && (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1 text-emerald-300">
                            <p className="font-semibold text-xs">Hospital Response:</p>
                            <p className="font-light">{req.hospitalResponse.notes}</p>
                          </div>
                        )}
                        {req.rejectionReason && (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1 text-rose-300">
                            <p className="font-semibold text-xs">Decline Reason:</p>
                            <p className="font-light">{req.rejectionReason}</p>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                        <span className="text-[11px] font-mono text-zinc-500">
                          Submitted on {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancelCareRequest(req._id)}
                            disabled={cancelCareRequestMutation.isPending}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                          >
                            Cancel Request
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: NOTIFICATIONS ─────────────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            {notificationsQuery.isLoading ? (
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-16 text-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" />
                <p className="text-xs font-mono text-zinc-400">Loading notifications…</p>
              </div>
            ) : notificationsQuery.data?.items.length === 0 ? (
              /* Empty State */
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-10 md:p-14 text-center space-y-4 shadow-2xl">
                <div className="bg-rose-500/10 text-rose-400 p-5 rounded-2xl border border-rose-500/20 inline-flex shadow-inner">
                  <Bell className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-light text-zinc-100 tracking-tight">No notifications yet</h3>
                  <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed font-light">
                    Direct updates regarding your medical appointments and care requests will appear here.
                  </p>
                </div>
              </div>
            ) : (
              /* Data Rows */
              <div className="grid gap-3">
                {notificationsQuery.data?.items.map((notif) => {
                  const isUnread = notif.status === 'UNREAD';
                  return (
                    <article
                      key={notif._id}
                      className={`p-5 rounded-2xl border backdrop-blur-xl transition-all duration-300 flex items-start justify-between gap-4 ${
                        isUnread
                          ? 'bg-rose-500/[0.05] border-rose-500/30 shadow-lg shadow-rose-950/20'
                          : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="space-y-1.5 text-xs flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-zinc-100 text-sm">{notif.title}</h4>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-zinc-300 leading-relaxed font-light">{notif.message}</p>
                        <p className="text-[10px] font-mono text-zinc-500 pt-1">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markReadMutation.mutate(notif._id)}
                          className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer"
                        >
                          Mark as read
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
