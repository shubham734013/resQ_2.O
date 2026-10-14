import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Building2,
  Clock,
  Phone,
  Search,
  Bell,
} from 'lucide-react';
import { useMyAppointments, useCancelAppointment } from '../hooks/useHospitalAppointments';
import { useMyCareRequests, useCancelCareRequest } from '../hooks/useHospitalCareRequests';
import { hospitalCareNotificationApi } from '../services/hospitalCareNotificationApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/common/Button';
import type { AppointmentStatus } from '../services/hospitalAppointmentApi';
import type { CareRequestStatus } from '../services/hospitalCareRequestApi';

export const CitizenAppointmentsPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'appointments' | 'requests' | 'notifications'>('appointments');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'ACCEPTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">{status}</span>;
      case 'PENDING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">PENDING</span>;
      case 'ALTERNATIVE_PROPOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">NEW TIME PROPOSED</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">COMPLETED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">CANCELLED</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">DECLINED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Hospital Requests & Appointments</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage your direct hospital consultations, reserved time slots, and responses.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<Search className="w-4 h-4" />}
            onClick={() => navigate('/search')}
          >
            Find Hospitals
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'appointments'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Appointments</span>
            {appointmentsQuery.data?.pagination.total ? (
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                {appointmentsQuery.data.pagination.total}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Direct Care Requests</span>
            {careRequestsQuery.data?.pagination.total ? (
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                {careRequestsQuery.data.pagination.total}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-slate-800 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
            {notificationsQuery.data?.items.filter((n) => n.status === 'UNREAD').length ? (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-xs font-bold">
                {notificationsQuery.data.items.filter((n) => n.status === 'UNREAD').length}
              </span>
            ) : null}
          </button>
        </div>

        {/* Tab 1: Appointments List */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            {/* Filter pills */}
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

            {appointmentsQuery.isLoading ? (
              <div className="p-12 text-center text-sm text-slate-400">Loading appointments...</div>
            ) : appointmentsQuery.data?.items.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-800">No appointments found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  You have not scheduled any appointments matching this filter.
                </p>
                <Button variant="primary" size="sm" onClick={() => navigate('/search')}>
                  Browse Healthcare Facilities
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {appointmentsQuery.data?.items.map((appt) => {
                  const hospital = typeof appt.hospitalId === 'object' ? appt.hospitalId : null;
                  const canCancel = ['PENDING', 'CONFIRMED', 'ALTERNATIVE_PROPOSED'].includes(appt.status);

                  return (
                    <div
                      key={appt._id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base">
                              {hospital?.name ?? 'Healthcare Facility'}
                            </h3>
                            {getStatusBadge(appt.status)}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {appt.serviceDepartment} Department
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded-md text-slate-700">
                            {appt.appointmentCode}
                          </span>
                        </div>
                      </div>

                      {/* Date & Time details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl text-xs">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div>
                            <p className="text-[10px] text-slate-400">Date</p>
                            <p className="font-semibold">{appt.slotDate}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-slate-700">
                          <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div>
                            <p className="text-[10px] text-slate-400">Time Window</p>
                            <p className="font-semibold">{appt.startTime} - {appt.endTime} ({appt.slotDurationMinutes} min)</p>
                          </div>
                        </div>

                        {hospital?.phone && (
                          <div className="flex items-center gap-2 text-slate-700">
                            <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                            <div>
                              <p className="text-[10px] text-slate-400">Hospital Phone</p>
                              <a href={`tel:${hospital.phone}`} className="font-semibold text-blue-600 hover:underline">
                                {hospital.phone}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reason & Hospital Notes */}
                      <div className="space-y-1.5 text-xs">
                        <p className="text-slate-600">
                          <span className="font-semibold text-slate-800">Visit Reason:</span> {appt.visitReason}
                        </p>
                        {appt.notes && (
                          <p className="text-slate-600">
                            <span className="font-semibold text-slate-800">Instructions:</span> {appt.notes}
                          </p>
                        )}
                        {appt.rejectionReason && (
                          <p className="text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                            <span className="font-semibold">Reason for Decline:</span> {appt.rejectionReason}
                          </p>
                        )}
                      </div>

                      {/* Alternative Proposal Callout */}
                      {appt.status === 'ALTERNATIVE_PROPOSED' && appt.alternativeSlot && (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center gap-2 font-semibold text-indigo-900">
                            <Clock className="w-4 h-4 text-indigo-600" />
                            <span>Hospital Proposed an Alternative Slot:</span>
                          </div>
                          <p className="text-indigo-800">
                            <span className="font-bold">{appt.alternativeSlot.date}</span> at <span className="font-bold">{appt.alternativeSlot.startTime}</span>
                            {appt.alternativeSlot.notes ? ` — "${appt.alternativeSlot.notes}"` : ''}
                          </p>
                          <p className="text-[11px] text-indigo-700">
                            Please contact the hospital at {hospital?.phone} to confirm or reschedule.
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-[11px] text-slate-400">
                          Booked on {new Date(appt.createdAt).toLocaleDateString()}
                        </span>
                        {canCancel && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCancelAppointment(appt._id)}
                            disabled={cancelAppointmentMutation.isPending}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            Cancel Appointment
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

        {/* Tab 2: Direct Care Requests */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {/* Filter pills */}
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

            {careRequestsQuery.isLoading ? (
              <div className="p-12 text-center text-sm text-slate-400">Loading care requests...</div>
            ) : careRequestsQuery.data?.items.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-800">No care requests found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  You haven't submitted any direct care requests matching this status.
                </p>
                <Button variant="primary" size="sm" onClick={() => navigate('/search')}>
                  Browse Healthcare Facilities
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {careRequestsQuery.data?.items.map((req) => {
                  const hospital = typeof req.hospitalId === 'object' ? req.hospitalId : null;
                  const canCancel = req.status === 'PENDING';

                  return (
                    <div
                      key={req._id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base">
                              {hospital?.name ?? 'Healthcare Facility'}
                            </h3>
                            {getStatusBadge(req.status)}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {req.serviceDepartment} &bull; {req.requestType.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded-md text-slate-700">
                            {req.referenceId}
                          </span>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                        <div>
                          <span className="text-slate-400">Timing Preference: </span>
                          <span className="font-medium text-slate-700">{req.preferredTiming}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Contact Preference: </span>
                          <span className="font-medium text-slate-700">{req.contactPreference}</span>
                        </div>
                      </div>

                      {/* Reason & Hospital response */}
                      <div className="space-y-1.5 text-xs">
                        <p className="text-slate-600">
                          <span className="font-semibold text-slate-800">Reason:</span> {req.visitReason}
                        </p>
                        {req.hospitalResponse?.notes && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-900">
                            <p className="font-semibold">Hospital Response:</p>
                            <p>{req.hospitalResponse.notes}</p>
                          </div>
                        )}
                        {req.rejectionReason && (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-900">
                            <p className="font-semibold">Decline Reason:</p>
                            <p>{req.rejectionReason}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-[11px] text-slate-400">
                          Submitted on {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                        {canCancel && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCancelCareRequest(req._id)}
                            disabled={cancelCareRequestMutation.isPending}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            Cancel Request
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

        {/* Tab 3: Notifications */}
        {activeTab === 'notifications' && (
          <div className="space-y-3">
            {notificationsQuery.isLoading ? (
              <div className="p-12 text-center text-sm text-slate-400">Loading notifications...</div>
            ) : notificationsQuery.data?.items.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No notifications yet</p>
                <p className="text-xs text-slate-400">Updates about appointments and care requests will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {notificationsQuery.data?.items.map((notif) => {
                  const isUnread = notif.status === 'UNREAD';
                  return (
                    <div
                      key={notif._id}
                      className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                        isUnread
                          ? 'bg-blue-50/70 border-blue-200 shadow-xs'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{notif.title}</h4>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-slate-600 leading-relaxed">{notif.message}</p>
                        <p className="text-[10px] text-slate-400 pt-1">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markReadMutation.mutate(notif._id)}
                          className="shrink-0 text-xs text-blue-600"
                        >
                          Mark as read
                        </Button>
                      )}
                    </div>
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
