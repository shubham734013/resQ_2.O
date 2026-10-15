import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Phone,
  ChevronRight,
  HeartPulse,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { emergencyApi } from '../../services/emergencyApi';
import { hospitalAppointmentApi, type HospitalAppointment } from '../../services/hospitalAppointmentApi';
import { facilityApi } from '../../services/facilityApi';
import type { Facility } from '../../types/facility';
import { ROUTES } from '../../routes/routePaths';
import { StatusBadge } from '../../components/common/StatusBadge';

export const UserDashboardPage = () => {
  const { user } = useAuth();

  // Load active emergencies
  const activeEmergencies = useQuery({
    queryKey: ['emergency-requests', 'active'],
    queryFn: async () => {
      const response = await emergencyApi.list({ limit: 5 });
      return response.items.filter((item) =>
        ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(item.status)
      );
    },
  });

  // Load citizen appointments
  const appointments = useQuery({
    queryKey: ['citizen-appointments', 'dashboard'],
    queryFn: () => hospitalAppointmentApi.listMyAppointments({ limit: 10 }),
  });

  // Load nearby facilities preview
  const nearbyHospitals = useQuery({
    queryKey: ['facilities', 'dashboard-nearby'],
    queryFn: () => facilityApi.search({ latitude: 26.9124, longitude: 75.7873, radiusMeters: 15000, limit: 3 }),
  });

  const activeEmergency = activeEmergencies.data?.[0];
  const upcomingAppointment = (appointments.data?.items ?? []).find(
    (item: HospitalAppointment) => item.status === 'CONFIRMED' || item.status === 'PENDING'
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full font-sans text-slate-900">
      {/* Welcome Banner & Quick Action */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300 border border-teal-500/30 mb-3">
            <HeartPulse className="h-3.5 w-3.5" /> Connected Healthcare Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Welcome, {user?.name || 'Citizen'}
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Instant emergency SOS dispatch, verified hospital discovery, and concurrency-safe clinical appointments across Jaipur and Rajasthan.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={ROUTES.USER.EMERGENCY}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-700 transition"
            >
              <AlertTriangle className="h-4 w-4" /> Trigger Emergency SOS
            </Link>

            <Link
              to={ROUTES.USER.HOSPITALS}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              <Building2 className="h-4 w-4 text-teal-400" /> Find Hospitals
            </Link>
          </div>
        </div>
      </div>

      {/* Active Emergency Banner if present */}
      {activeEmergency && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/80 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shrink-0 mt-0.5 animate-pulse">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Active Emergency In Progress</span>
                  <StatusBadge variant="open" label={activeEmergency.status} />
                </div>
                <p className="mt-1 text-sm font-bold text-slate-900">{activeEmergency.situationType}</p>
                <p className="text-xs text-slate-600">{activeEmergency.location}</p>
              </div>
            </div>

            <Link
              to={ROUTES.USER.TRACKING(activeEmergency.id)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 shrink-0"
            >
              <Navigation className="h-4 w-4" /> View Live Tracking
            </Link>
          </div>
        </div>
      )}

      {/* Overview Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Next Appointment Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Calendar className="h-4 w-4 text-teal-600" />
                <span>Upcoming Appointment</span>
              </div>
              <Link to={ROUTES.USER.APPOINTMENTS} className="text-xs text-teal-700 font-semibold hover:underline">
                View all
              </Link>
            </div>

            {upcomingAppointment ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-bold text-sm text-slate-900">{upcomingAppointment.serviceDepartment}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {typeof upcomingAppointment.hospitalId === 'object' && upcomingAppointment.hospitalId
                    ? upcomingAppointment.hospitalId.name
                    : 'Hospital Facility'}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-teal-600" />
                  <span>{upcomingAppointment.slotDate} at {upcomingAppointment.startTime}</span>
                </div>
                <div className="mt-2">
                  <StatusBadge variant={upcomingAppointment.status === 'CONFIRMED' ? 'verified' : 'waitTime'} label={upcomingAppointment.status} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">No pending routine appointments booked.</p>
            )}
          </div>

          <Link
            to={ROUTES.USER.HOSPITALS}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Book a Clinic Slot
          </Link>
        </div>

        {/* Emergency Hotlines Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-4">
              <Phone className="h-4 w-4 text-rose-600" />
              <span>Emergency SOS Services</span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-rose-50/60 p-3 border border-rose-100">
                <span className="text-xs font-bold text-rose-950">National Helpline</span>
                <span className="text-sm font-black text-rose-700">112</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-xs font-bold text-slate-800">State Ambulance Service</span>
                <span className="text-sm font-black text-slate-900">108</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-xs font-bold text-slate-800">ResQ Command Desk</span>
                <span className="text-xs font-bold text-teal-700">+91 141 222 9999</span>
              </div>
            </div>
          </div>

          <Link
            to={ROUTES.USER.EMERGENCY}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
          >
            Start SOS Intake
          </Link>
        </div>

        {/* Verified Hospitals Preview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Building2 className="h-4 w-4 text-teal-600" />
              <span>Nearby Facilities</span>
            </div>
            <Link to={ROUTES.USER.HOSPITALS} className="text-xs text-teal-700 font-semibold hover:underline">
              Search all
            </Link>
          </div>

          <div className="space-y-2">
            {(nearbyHospitals.data?.items?.slice(0, 3) ?? []).map((h: Facility) => (
              <Link
                key={h.id}
                to={ROUTES.USER.HOSPITAL_DETAIL(h.id)}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-2.5 hover:bg-slate-50 transition"
              >
                <div className="min-w-0 pr-2">
                  <p className="truncate text-xs font-bold text-slate-900">{h.name}</p>
                  <p className="text-[11px] text-slate-500">{h.type} &bull; {h.distance}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
