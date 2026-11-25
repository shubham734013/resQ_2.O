import { useState } from 'react';
import {
  Calendar,
  Building2,
  Phone,
  Mail,
  Settings,
} from 'lucide-react';
import {
  useHospitalAppointments,
  useConfirmAppointment,
  useRejectAppointment,
  useProposeAlternativeSlot,
  useCompleteAppointment,
  useHospitalAvailabilitySettings,
  useUpdateHospitalAvailabilitySettings,
} from '../hooks/useHospitalAppointments';
import {
  useHospitalIncomingRequests,
  useRespondCareRequest,
} from '../hooks/useHospitalCareRequests';
import type { AppointmentStatus, DaySchedule } from '../services/hospitalAppointmentApi';
import type { CareRequestStatus } from '../services/hospitalCareRequestApi';

export interface HospitalAppointmentsPageProps {
  initialSubTab?: 'requests' | 'appointments' | 'availability';
}

export const HospitalAppointmentsPage = ({ initialSubTab = 'appointments' }: HospitalAppointmentsPageProps = {}) => {
  const [prevInitialSubTab, setPrevInitialSubTab] = useState(initialSubTab);
  const [subTab, setSubTab] = useState<'requests' | 'appointments' | 'availability'>(initialSubTab);

  if (initialSubTab !== prevInitialSubTab) {
    setPrevInitialSubTab(initialSubTab);
    setSubTab(initialSubTab);
  }

  // Request State
  const [requestStatusFilter, setRequestStatusFilter] = useState<CareRequestStatus | 'ALL'>('ALL');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [responseAction, setResponseAction] = useState<'ACCEPT' | 'REJECT' | null>(null);
  const [responseNotes, setResponseNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Appointment State
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [alternativeDate, setAlternativeDate] = useState('');
  const [alternativeTime, setAlternativeTime] = useState('10:00');
  const [alternativeNotes, setAlternativeNotes] = useState('');
  const [showAlternativeModal, setShowAlternativeModal] = useState(false);
  const [rejectApptModal, setRejectApptModal] = useState(false);
  const [apptRejectReason, setApptRejectReason] = useState('');

  // Availability Settings State
  const [editingDept, setEditingDept] = useState('Cardiology');
  const [slotDuration, setSlotDuration] = useState(30);
  const [slotCapacity, setSlotCapacity] = useState(1);
  const [blackoutDatesInput, setBlackoutDatesInput] = useState('');
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([
    { dayOfWeek: 0, isEnabled: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 1, isEnabled: true, startTime: '09:00', endTime: '17:00', breakStartTime: '13:00', breakEndTime: '14:00' },
    { dayOfWeek: 2, isEnabled: true, startTime: '09:00', endTime: '17:00', breakStartTime: '13:00', breakEndTime: '14:00' },
    { dayOfWeek: 3, isEnabled: true, startTime: '09:00', endTime: '17:00', breakStartTime: '13:00', breakEndTime: '14:00' },
    { dayOfWeek: 4, isEnabled: true, startTime: '09:00', endTime: '17:00', breakStartTime: '13:00', breakEndTime: '14:00' },
    { dayOfWeek: 5, isEnabled: true, startTime: '09:00', endTime: '17:00', breakStartTime: '13:00', breakEndTime: '14:00' },
    { dayOfWeek: 6, isEnabled: false, startTime: '09:00', endTime: '17:00' },
  ]);

  // Queries
  const incomingRequestsQuery = useHospitalIncomingRequests({
    status: requestStatusFilter === 'ALL' ? undefined : requestStatusFilter,
  });

  const appointmentsQuery = useHospitalAppointments({
    status: appointmentStatusFilter === 'ALL' ? undefined : appointmentStatusFilter,
    date: dateFilter || undefined,
  });

  const availabilitySettingsQuery = useHospitalAvailabilitySettings();

  // Mutations
  const respondCareMutation = useRespondCareRequest();
  const confirmApptMutation = useConfirmAppointment();
  const rejectApptMutation = useRejectAppointment();
  const proposeAltMutation = useProposeAlternativeSlot();
  const completeApptMutation = useCompleteAppointment();
  const updateSettingsMutation = useUpdateHospitalAvailabilitySettings();

  const handleRespondCareRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestId || !responseAction) return;

    respondCareMutation.mutate(
      {
        id: selectedRequestId,
        input: {
          action: responseAction,
          notes: responseAction === 'ACCEPT' ? responseNotes : undefined,
          rejectionReason: responseAction === 'REJECT' ? rejectionReason : undefined,
        },
      },
      {
        onSuccess: () => {
          setSelectedRequestId(null);
          setResponseAction(null);
          setResponseNotes('');
          setRejectionReason('');
        },
      }
    );
  };

  const handleProposeAlternative = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApptId || !alternativeDate || !alternativeTime) return;

    proposeAltMutation.mutate(
      {
        id: selectedApptId,
        input: {
          date: alternativeDate,
          startTime: alternativeTime,
          notes: alternativeNotes || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowAlternativeModal(false);
          setSelectedApptId(null);
          setAlternativeDate('');
          setAlternativeTime('10:00');
          setAlternativeNotes('');
        },
      }
    );
  };

  const handleRejectAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApptId || !apptRejectReason) return;

    rejectApptMutation.mutate(
      {
        id: selectedApptId,
        rejectionReason: apptRejectReason,
      },
      {
        onSuccess: () => {
          setRejectApptModal(false);
          setSelectedApptId(null);
          setApptRejectReason('');
        },
      }
    );
  };

  const handleSaveAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    const blackoutDates = blackoutDatesInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));

    updateSettingsMutation.mutate({
      department: editingDept.trim(),
      slotDurationMinutes: Number(slotDuration),
      maxCapacityPerSlot: Number(slotCapacity),
      weeklySchedule,
      blackoutDates,
      isActive: true,
    });
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const statusLabel = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      {/* Subtab navigation */}
      <div className="bg-white/[0.03] border border-white/10 p-1.5 rounded-2xl flex flex-wrap gap-2 backdrop-blur-xl shadow-xl">
        <button
          onClick={() => setSubTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium rounded-xl transition-all ${
            subTab === 'requests'
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] font-semibold'
              : 'border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Care requests</span>
        </button>

        <button
          onClick={() => setSubTab('appointments')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium rounded-xl transition-all ${
            subTab === 'appointments'
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] font-semibold'
              : 'border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Appointments</span>
        </button>

        <button
          onClick={() => setSubTab('availability')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium rounded-xl transition-all ${
            subTab === 'availability'
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] font-semibold'
              : 'border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Hours and slots</span>
        </button>
      </div>

      {/* Subtab 1: Incoming Care Requests */}
      {subTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setRequestStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all ${
                    requestStatusFilter === st
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] font-semibold'
                      : 'bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]'
                  }`}
                >
                  {st === 'ALL' ? 'All' : statusLabel(st)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400 bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-xl">
                Requests: <span className="text-zinc-200 font-semibold">{incomingRequestsQuery.data?.pagination.total ?? 0}</span>
              </span>
            </div>
          </div>

          {incomingRequestsQuery.isLoading ? (
            <div className="p-12 text-center text-sm font-mono text-zinc-500 bg-white/[0.02] border border-white/10 rounded-2xl">
              Loading care requests...
            </div>
          ) : incomingRequestsQuery.data?.items.length === 0 ? (
            <div className="p-12 bg-white/[0.02] rounded-2xl border border-white/10 text-center text-sm font-mono text-zinc-500">
              No care requests found.
            </div>
          ) : (
            <div className="grid gap-3">
              {incomingRequestsQuery.data?.items.map((req) => {
                const user = typeof req.userId === 'object' ? req.userId : null;
                const isPending = req.status === 'PENDING';

                return (
                  <div
                    key={req._id}
                    className="p-5 sm:p-6 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl space-y-4 hover:border-white/20 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 pb-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-zinc-100 text-sm tracking-tight">
                            {user?.name ?? 'Patient'}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                              req.status === 'ACCEPTED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : req.status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                                : req.status === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {statusLabel(req.status)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          <span className="text-zinc-300 font-medium">{req.serviceDepartment}</span> &bull; {statusLabel(req.requestType)} &bull; Time: <span className="font-mono text-zinc-300">{req.preferredTiming}</span>
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <span className="font-mono text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                          {req.referenceId}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-300 bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1">
                      <span className="font-semibold text-zinc-200">Reason for visit:</span> {req.visitReason}
                    </div>

                    {user && (
                      <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                        {user.phone && (
                          <span className="flex items-center gap-1.5 text-zinc-300 font-mono">
                            <Phone className="w-3.5 h-3.5 text-zinc-400" />
                            {user.phone}
                          </span>
                        )}
                        {user.email && (
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            <Mail className="w-3.5 h-3.5 text-zinc-400" />
                            {user.email}
                          </span>
                        )}
                        <span className="text-zinc-500 font-mono text-[11px]">
                          Sent {new Date(req.createdAt).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {isPending && (
                      <div className="flex gap-2.5 justify-end pt-3 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequestId(req._id);
                            setResponseAction('REJECT');
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 bg-white/[0.04] border border-white/10 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30 transition-all"
                        >
                          Say no
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequestId(req._id);
                            setResponseAction('ACCEPT');
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-500 shadow-lg shadow-rose-950/50 hover:from-rose-500 hover:to-rose-400 transition-all"
                        >
                          Accept
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Subtab 2: Appointments Schedule */}
      {subTab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {(['ALL', 'PENDING', 'CONFIRMED', 'ALTERNATIVE_PROPOSED', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setAppointmentStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all ${
                    appointmentStatusFilter === st
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] font-semibold'
                      : 'bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]'
                  }`}
                >
                  {st === 'ALL' ? 'All' : statusLabel(st)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-zinc-400">Date:</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-8 px-2.5 text-xs bg-white/[0.04] border border-white/10 text-zinc-200 rounded-xl outline-none focus:border-rose-500/50 [color-scheme:dark]"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="text-xs text-rose-400 hover:text-rose-300 font-mono underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {appointmentsQuery.isLoading ? (
            <div className="p-12 text-center text-sm font-mono text-zinc-500 bg-white/[0.02] border border-white/10 rounded-2xl">
              Loading appointments…
            </div>
          ) : appointmentsQuery.data?.items.length === 0 ? (
            <div className="p-12 bg-white/[0.02] rounded-2xl border border-white/10 text-center text-sm font-mono text-zinc-500">
              No appointments found.
            </div>
          ) : (
            <div className="grid gap-3">
              {appointmentsQuery.data?.items.map((appt) => {
                const user = typeof appt.userId === 'object' ? appt.userId : null;

                return (
                  <div
                    key={appt._id}
                    className="p-5 sm:p-6 bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl space-y-4 hover:border-white/20 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 pb-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-zinc-100 text-sm tracking-tight">
                            {user?.name ?? 'Patient'}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                              appt.status === 'CONFIRMED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : appt.status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                                : appt.status === 'ALTERNATIVE_PROPOSED'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                                : appt.status === 'COMPLETED'
                                ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {statusLabel(appt.status)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          <span className="text-zinc-300 font-medium">{appt.serviceDepartment}</span> &bull;{' '}
                          <span className="font-mono text-zinc-300">{appt.slotDate}</span> ({appt.startTime} - {appt.endTime})
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <span className="font-mono text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                          {appt.appointmentCode}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-300 bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1">
                      <div>
                        <span className="font-semibold text-zinc-200">Reason for visit:</span> {appt.visitReason}
                      </div>
                      {appt.notes && (
                        <p className="mt-1 text-zinc-400">
                          <span className="font-semibold text-zinc-300">Notes:</span> {appt.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions based on status */}
                    <div className="flex flex-wrap gap-2.5 justify-end pt-3 border-t border-white/5">
                      {appt.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedApptId(appt._id);
                              setRejectApptModal(true);
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 bg-white/[0.04] border border-white/10 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30 transition-all"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedApptId(appt._id);
                              setAlternativeDate(appt.slotDate);
                              setShowAlternativeModal(true);
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all"
                          >
                            Suggest a new time
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmApptMutation.mutate({ id: appt._id })}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-500 shadow-lg shadow-rose-950/50 hover:from-rose-500 hover:to-rose-400 transition-all"
                          >
                            Confirm
                          </button>
                        </>
                      )}

                      {appt.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          onClick={() => completeApptMutation.mutate(appt._id)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all shadow-lg shadow-emerald-950/30"
                        >
                          Mark as done
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Subtab 3: Hours and slots */}
      {subTab === 'availability' && (
        <form onSubmit={handleSaveAvailability} className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 p-6 sm:p-8 space-y-6 max-w-4xl shadow-2xl">
          <div>
            <h3 className="font-semibold text-zinc-100 text-base tracking-tight">Set department hours</h3>
            <p className="text-xs text-zinc-400 mt-1">Choose open days, hours, and how many patients can book each time slot.</p>
          </div>

          {availabilitySettingsQuery.data && availabilitySettingsQuery.data.length > 0 && (
            <div className="space-y-2.5 p-4 bg-white/[0.02] rounded-xl border border-white/5">
              <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">Departments with saved hours:</span>
              <div className="flex flex-wrap gap-2">
                {availabilitySettingsQuery.data.map((cfg) => (
                  <button
                    key={cfg.department}
                    type="button"
                    onClick={() => {
                      setEditingDept(cfg.department);
                      setSlotDuration(cfg.slotDurationMinutes);
                      setSlotCapacity(cfg.maxCapacityPerSlot);
                      setWeeklySchedule(cfg.weeklySchedule);
                      setBlackoutDatesInput(cfg.blackoutDates.join(', '));
                    }}
                    className="px-3 py-1.5 text-xs bg-white/[0.04] border border-white/10 rounded-xl hover:border-rose-500/40 hover:text-rose-300 font-mono text-zinc-300 transition-all"
                  >
                    {cfg.department} ({cfg.slotDurationMinutes} min &bull; up to {cfg.maxCapacityPerSlot} patients)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Department</label>
              <input
                type="text"
                value={editingDept}
                onChange={(e) => setEditingDept(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white/[0.04] border border-white/10 text-zinc-100 rounded-xl outline-none focus:border-rose-500/50"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Visit length</label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="w-full h-10 px-3 text-xs bg-zinc-900 border border-white/10 text-zinc-100 rounded-xl outline-none focus:border-rose-500/50 [color-scheme:dark]"
              >
                <option value={15} className="bg-zinc-900 text-zinc-100">15 minutes</option>
                <option value={20} className="bg-zinc-900 text-zinc-100">20 minutes</option>
                <option value={30} className="bg-zinc-900 text-zinc-100">30 minutes</option>
                <option value={45} className="bg-zinc-900 text-zinc-100">45 minutes</option>
                <option value={60} className="bg-zinc-900 text-zinc-100">60 minutes</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Patients per time</label>
              <input
                type="number"
                min={1}
                max={20}
                value={slotCapacity}
                onChange={(e) => setSlotCapacity(Number(e.target.value))}
                className="w-full h-10 px-3 text-xs bg-white/[0.04] border border-white/10 text-zinc-100 rounded-xl outline-none focus:border-rose-500/50"
                required
              />
            </div>
          </div>

          {/* Weekly Schedule Table */}
          <div className="space-y-2.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Weekly hours</label>
            <div className="space-y-2">
              {weeklySchedule.map((day, idx) => (
                <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-zinc-300">
                  <label className="w-28 font-medium flex items-center gap-2 cursor-pointer text-zinc-200">
                    <input
                      type="checkbox"
                      checked={day.isEnabled}
                      onChange={(e) => {
                        const next = [...weeklySchedule];
                        const target = next[idx];
                        if (target) target.isEnabled = e.target.checked;
                        setWeeklySchedule(next);
                      }}
                      className="rounded accent-rose-500 w-4 h-4"
                    />
                    <span>{dayNames[day.dayOfWeek]}</span>
                  </label>

                  {day.isEnabled ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) => {
                          const next = [...weeklySchedule];
                          const target = next[idx];
                          if (target) target.startTime = e.target.value;
                          setWeeklySchedule(next);
                        }}
                        className="h-8 px-2.5 bg-white/[0.04] border border-white/10 text-zinc-200 rounded-lg outline-none focus:border-rose-500/50 [color-scheme:dark]"
                      />
                      <span className="text-zinc-500 text-xs">to</span>
                      <input
                        type="time"
                        value={day.endTime}
                        onChange={(e) => {
                          const next = [...weeklySchedule];
                          const target = next[idx];
                          if (target) target.endTime = e.target.value;
                          setWeeklySchedule(next);
                        }}
                        className="h-8 px-2.5 bg-white/[0.04] border border-white/10 text-zinc-200 rounded-lg outline-none focus:border-rose-500/50 [color-scheme:dark]"
                      />
                      <span className="text-zinc-500 text-[11px] ml-2 font-mono">Break time:</span>
                      <input
                        type="time"
                        value={day.breakStartTime || ''}
                        onChange={(e) => {
                          const next = [...weeklySchedule];
                          const target = next[idx];
                          if (target) target.breakStartTime = e.target.value || undefined;
                          setWeeklySchedule(next);
                        }}
                        className="h-8 px-2.5 bg-white/[0.04] border border-white/10 text-zinc-200 rounded-lg outline-none focus:border-rose-500/50 [color-scheme:dark]"
                      />
                      <span className="text-zinc-500 text-xs">-</span>
                      <input
                        type="time"
                        value={day.breakEndTime || ''}
                        onChange={(e) => {
                          const next = [...weeklySchedule];
                          const target = next[idx];
                          if (target) target.breakEndTime = e.target.value || undefined;
                          setWeeklySchedule(next);
                        }}
                        className="h-8 px-2.5 bg-white/[0.04] border border-white/10 text-zinc-200 rounded-lg outline-none focus:border-rose-500/50 [color-scheme:dark]"
                      />
                    </div>
                  ) : (
                    <span className="text-zinc-500 italic font-mono text-xs">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Dates when closed (use YYYY-MM-DD, separate with commas)</label>
            <input
              type="text"
              placeholder="2026-12-25, 2027-01-01"
              value={blackoutDatesInput}
              onChange={(e) => setBlackoutDatesInput(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-white/[0.04] border border-white/10 text-zinc-100 placeholder-zinc-500 rounded-xl outline-none focus:border-rose-500/50 font-mono"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-white/5">
            <button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-500 shadow-lg shadow-rose-950/50 hover:from-rose-500 hover:to-rose-400 transition-all disabled:opacity-50"
            >
              {updateSettingsMutation.isPending ? 'Saving…' : 'Save hours'}
            </button>
          </div>
        </form>
      )}

      {/* Accept / Decline Care Request Modal */}
      {selectedRequestId && responseAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleRespondCareRequest} className="w-full max-w-md bg-zinc-950/95 border border-white/15 backdrop-blur-2xl rounded-2xl shadow-2xl p-6 space-y-4 text-zinc-100">
            <h3 className="font-semibold text-zinc-100 text-base tracking-tight">
              {responseAction === 'ACCEPT' ? 'Accept care request' : 'Say no to care request'}
            </h3>

            {responseAction === 'ACCEPT' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Note for patient (optional)</label>
                <textarea
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  rows={3}
                  placeholder="For example: Please come 15 minutes early and bring your medical papers."
                  className="w-full p-3 text-xs bg-white/[0.04] border border-white/10 rounded-xl text-zinc-100 placeholder-zinc-500 outline-none focus:border-rose-500/50"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Why can't you accept? (Required)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="For example: The doctor is away. Please call next week."
                  className="w-full p-3 text-xs bg-white/[0.04] border border-white/10 rounded-xl text-zinc-100 placeholder-zinc-500 outline-none focus:border-rose-500/50"
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequestId(null);
                  setResponseAction(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:text-zinc-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={respondCareMutation.isPending}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-lg ${
                  responseAction === 'ACCEPT'
                    ? 'bg-gradient-to-r from-rose-600 to-rose-500 shadow-rose-950/50 hover:from-rose-500 hover:to-rose-400'
                    : 'bg-rose-600/90 hover:bg-rose-600 shadow-rose-950/60'
                }`}
              >
                {respondCareMutation.isPending ? 'Sending…' : responseAction === 'ACCEPT' ? 'Accept request' : 'Send reply'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Propose Alternative Time Modal */}
      {showAlternativeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleProposeAlternative} className="w-full max-w-md bg-zinc-950/95 border border-white/15 backdrop-blur-2xl rounded-2xl shadow-2xl p-6 space-y-4 text-zinc-100">
            <div>
              <h3 className="font-semibold text-zinc-100 text-base tracking-tight">Suggest a new time</h3>
              <p className="text-xs text-zinc-400 mt-1">Offer a new date or time for this visit.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Date</label>
                <input
                  type="date"
                  value={alternativeDate}
                  onChange={(e) => setAlternativeDate(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white/[0.04] border border-white/10 text-zinc-100 rounded-xl outline-none focus:border-rose-500/50 [color-scheme:dark]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Time</label>
                <input
                  type="time"
                  value={alternativeTime}
                  onChange={(e) => setAlternativeTime(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white/[0.04] border border-white/10 text-zinc-100 rounded-xl outline-none focus:border-rose-500/50 [color-scheme:dark]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Note for Patient</label>
              <input
                type="text"
                placeholder="For example: The doctor is busy at that time."
                value={alternativeNotes}
                onChange={(e) => setAlternativeNotes(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white/[0.04] border border-white/10 text-zinc-100 placeholder-zinc-500 rounded-xl outline-none focus:border-rose-500/50"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowAlternativeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:text-zinc-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={proposeAltMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-500 shadow-lg shadow-rose-950/50 hover:from-rose-500 hover:to-rose-400 transition-all"
              >
                {proposeAltMutation.isPending ? 'Sending…' : 'Send new time'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Appointment Modal */}
      {rejectApptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleRejectAppointment} className="w-full max-w-md bg-zinc-950/95 border border-white/15 backdrop-blur-2xl rounded-2xl shadow-2xl p-6 space-y-4 text-zinc-100">
            <div>
              <h3 className="font-semibold text-zinc-100 text-base tracking-tight">Say no to appointment</h3>
              <p className="text-xs text-zinc-400 mt-1">Tell the patient why this visit cannot happen.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Why can't you accept? (Required)</label>
              <textarea
                value={apptRejectReason}
                onChange={(e) => setApptRejectReason(e.target.value)}
                rows={3}
                placeholder="For example: The doctor is not available."
                className="w-full p-3 text-xs bg-white/[0.04] border border-white/10 rounded-xl text-zinc-100 placeholder-zinc-500 outline-none focus:border-rose-500/50"
                required
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setRejectApptModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:text-zinc-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rejectApptMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600/90 hover:bg-rose-600 shadow-lg shadow-rose-950/60 transition-all"
              >
                {rejectApptMutation.isPending ? 'Sending…' : 'Say no'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
