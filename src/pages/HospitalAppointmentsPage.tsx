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
import { Button } from '../components/common/Button';
import type { AppointmentStatus, DaySchedule } from '../services/hospitalAppointmentApi';
import type { CareRequestStatus } from '../services/hospitalCareRequestApi';

export const HospitalAppointmentsPage = () => {
  const [subTab, setSubTab] = useState<'requests' | 'appointments' | 'availability'>('requests');

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Subtab navigation */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setSubTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            subTab === 'requests'
              ? 'border-slate-900 text-slate-950 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Incoming Care Requests</span>
        </button>

        <button
          onClick={() => setSubTab('appointments')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            subTab === 'appointments'
              ? 'border-slate-900 text-slate-950 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Appointments Schedule</span>
        </button>

        <button
          onClick={() => setSubTab('availability')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            subTab === 'availability'
              ? 'border-slate-900 text-slate-950 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Availability Configuration</span>
        </button>
      </div>

      {/* Subtab 1: Incoming Care Requests */}
      {subTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2 text-xs">
              {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setRequestStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    requestStatusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              Total: {incomingRequestsQuery.data?.pagination.total ?? 0}
            </span>
          </div>

          {incomingRequestsQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading incoming requests...</div>
          ) : incomingRequestsQuery.data?.items.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-sm text-slate-400">
              No care requests found for this filter.
            </div>
          ) : (
            <div className="grid gap-3">
              {incomingRequestsQuery.data?.items.map((req) => {
                const user = typeof req.userId === 'object' ? req.userId : null;
                const isPending = req.status === 'PENDING';

                return (
                  <div
                    key={req._id}
                    className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {user?.name ?? 'Patient'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'ACCEPTED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {req.serviceDepartment} &bull; {req.requestType.replace(/_/g, ' ')} &bull; Timing: {req.preferredTiming}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {req.referenceId}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg">
                      <span className="font-semibold text-slate-900">Visit Reason:</span> {req.visitReason}
                    </div>

                    {user && (
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {user.phone}
                          </span>
                        )}
                        {user.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {user.email}
                          </span>
                        )}
                        <span className="text-slate-400">
                          Submitted {new Date(req.createdAt).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {isPending && (
                      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedRequestId(req._id);
                            setResponseAction('REJECT');
                          }}
                        >
                          Decline Request
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedRequestId(req._id);
                            setResponseAction('ACCEPT');
                          }}
                        >
                          Accept Request
                        </Button>
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
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    appointmentStatusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Filter by Date:</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-8 px-2 text-xs bg-white border border-slate-200 rounded-md outline-none"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {appointmentsQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading appointments...</div>
          ) : appointmentsQuery.data?.items.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-sm text-slate-400">
              No appointments scheduled for this filter.
            </div>
          ) : (
            <div className="grid gap-3">
              {appointmentsQuery.data?.items.map((appt) => {
                const user = typeof appt.userId === 'object' ? appt.userId : null;

                return (
                  <div
                    key={appt._id}
                    className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {user?.name ?? 'Patient'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              appt.status === 'CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : appt.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : appt.status === 'ALTERNATIVE_PROPOSED'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {appt.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {appt.serviceDepartment} &bull; {appt.slotDate} ({appt.startTime} - {appt.endTime})
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {appt.appointmentCode}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg">
                      <span className="font-semibold text-slate-900">Reason:</span> {appt.visitReason}
                      {appt.notes && (
                        <p className="mt-1 text-slate-500">
                          <span className="font-semibold text-slate-700">Patient Notes:</span> {appt.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions based on status */}
                    <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-slate-100">
                      {appt.status === 'PENDING' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedApptId(appt._id);
                              setRejectApptModal(true);
                            }}
                          >
                            Decline
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedApptId(appt._id);
                              setAlternativeDate(appt.slotDate);
                              setShowAlternativeModal(true);
                            }}
                          >
                            Propose New Time
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => confirmApptMutation.mutate({ id: appt._id })}
                          >
                            Confirm Appointment
                          </Button>
                        </>
                      )}

                      {appt.status === 'CONFIRMED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => completeApptMutation.mutate(appt._id)}
                        >
                          Mark Completed
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Subtab 3: Availability Configuration */}
      {subTab === 'availability' && (
        <form onSubmit={handleSaveAvailability} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 max-w-3xl">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Department Availability Configuration</h3>
            <p className="text-xs text-slate-500">Configure weekly operating hours, appointment slot durations, and capacity per slot.</p>
          </div>

          {availabilitySettingsQuery.data && availabilitySettingsQuery.data.length > 0 && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Currently Configured Departments:</span>
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
                    className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 font-medium text-slate-800"
                  >
                    {cfg.department} ({cfg.slotDurationMinutes}m, cap: {cfg.maxCapacityPerSlot})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Department</label>
              <input
                type="text"
                value={editingDept}
                onChange={(e) => setEditingDept(e.target.value)}
                className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg outline-none focus:border-slate-400"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Slot Duration (Minutes)</label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg outline-none"
              >
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Max Capacity / Slot</label>
              <input
                type="number"
                min={1}
                max={20}
                value={slotCapacity}
                onChange={(e) => setSlotCapacity(Number(e.target.value))}
                className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg outline-none"
                required
              />
            </div>
          </div>

          {/* Weekly Schedule Table */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Weekly Schedule</label>
            <div className="space-y-2">
              {weeklySchedule.map((day, idx) => (
                <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl text-xs">
                  <label className="w-24 font-bold flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={day.isEnabled}
                      onChange={(e) => {
                        const next = [...weeklySchedule];
                        const target = next[idx];
                        if (target) target.isEnabled = e.target.checked;
                        setWeeklySchedule(next);
                      }}
                      className="rounded"
                    />
                    <span>{dayNames[day.dayOfWeek]}</span>
                  </label>

                  {day.isEnabled ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) => {
                          const next = [...weeklySchedule];
                          const target = next[idx];
                          if (target) target.startTime = e.target.value;
                          setWeeklySchedule(next);
                        }}
                        className="h-8 px-2 bg-white border border-slate-200 rounded"
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={day.endTime}
                        onChange={(e) => {
                          const next = [...weeklySchedule];
                          const target = next[idx];
                          if (target) target.endTime = e.target.value;
                          setWeeklySchedule(next);
                        }}
                        className="h-8 px-2 bg-white border border-slate-200 rounded"
                      />
                      <span className="text-slate-400 text-[11px] ml-2">Break:</span>
                      <input
                        type="time"
                        value={day.breakStartTime || ''}
                        onChange={(e) => {
                          const next = [...weeklySchedule];
                          const target = next[idx];
                          if (target) target.breakStartTime = e.target.value || undefined;
                          setWeeklySchedule(next);
                        }}
                        className="h-8 px-2 bg-white border border-slate-200 rounded"
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={day.breakEndTime || ''}
                        onChange={(e) => {
                          const next = [...weeklySchedule];
                          const target = next[idx];
                          if (target) target.breakEndTime = e.target.value || undefined;
                          setWeeklySchedule(next);
                        }}
                        className="h-8 px-2 bg-white border border-slate-200 rounded"
                      />
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Blackout Dates (Comma-separated YYYY-MM-DD)</label>
            <input
              type="text"
              placeholder="2026-12-25, 2027-01-01"
              value={blackoutDatesInput}
              onChange={(e) => setBlackoutDatesInput(e.target.value)}
              className="w-full h-10 px-3 text-xs border border-slate-200 rounded-lg outline-none"
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="primary" size="md" type="submit" disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Availability Settings'}
            </Button>
          </div>
        </form>
      )}

      {/* Accept / Decline Care Request Modal */}
      {selectedRequestId && responseAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <form onSubmit={handleRespondCareRequest} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              {responseAction === 'ACCEPT' ? 'Accept Care Request' : 'Decline Care Request'}
            </h3>

            {responseAction === 'ACCEPT' ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Instructions / Notes for Patient (Optional)</label>
                <textarea
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Please arrive 15 minutes before 10:00 AM with prior medical reports..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg outline-none"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Reason for Declining (Required)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. The specialist is on leave; please contact next week..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg outline-none"
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  setSelectedRequestId(null);
                  setResponseAction(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant={responseAction === 'ACCEPT' ? 'primary' : 'emergency'}
                size="sm"
                type="submit"
                disabled={respondCareMutation.isPending}
              >
                {respondCareMutation.isPending ? 'Submitting...' : responseAction === 'ACCEPT' ? 'Confirm Acceptance' : 'Decline'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Propose Alternative Time Modal */}
      {showAlternativeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <form onSubmit={handleProposeAlternative} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Propose Alternative Time</h3>
            <p className="text-xs text-slate-500">Offer the patient an alternative date or time window for this appointment.</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Date</label>
                <input
                  type="date"
                  value={alternativeDate}
                  onChange={(e) => setAlternativeDate(e.target.value)}
                  className="w-full h-9 px-2 text-xs border border-slate-200 rounded-lg outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Time</label>
                <input
                  type="time"
                  value={alternativeTime}
                  onChange={(e) => setAlternativeTime(e.target.value)}
                  className="w-full h-9 px-2 text-xs border border-slate-200 rounded-lg outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Note for Patient</label>
              <input
                type="text"
                placeholder="Doctor in surgery at original time..."
                value={alternativeNotes}
                onChange={(e) => setAlternativeNotes(e.target.value)}
                className="w-full h-9 px-2 text-xs border border-slate-200 rounded-lg outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setShowAlternativeModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={proposeAltMutation.isPending}
              >
                {proposeAltMutation.isPending ? 'Sending...' : 'Send Proposal'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Appointment Modal */}
      {rejectApptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <form onSubmit={handleRejectAppointment} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Decline Appointment</h3>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Reason for Declining (Required)</label>
              <textarea
                value={apptRejectReason}
                onChange={(e) => setApptRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Clinic undergoing deep sanitization / Doctor unavailable..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setRejectApptModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="emergency"
                size="sm"
                type="submit"
                disabled={rejectApptMutation.isPending}
              >
                {rejectApptMutation.isPending ? 'Declining...' : 'Decline Appointment'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
