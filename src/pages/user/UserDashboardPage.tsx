import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Phone,
  ChevronRight,
  Navigation,
  MapPin,
  Star,
  Ambulance,
  Share2,
  FileText,
  Users,
  Beaker,
  RefreshCw,
} from 'lucide-react';
import { emergencyApi } from '../../services/emergencyApi';
import { hospitalAppointmentApi, type HospitalAppointment } from '../../services/hospitalAppointmentApi';
import { facilityApi } from '../../services/facilityApi';
import type { Facility } from '../../types/facility';
import { ROUTES } from '../../routes/routePaths';
import { StatusBadge } from '../../components/common/StatusBadge';
import { MapView } from '../../components/map/MapView';
import { DEFAULT_JAIPUR_COORDINATES } from '../../types/maps';
import { useLocationState } from '../../hooks/useLocationState';

// ─── Nearby ambulances mock (no public ambulance-search API) ──────────────────
const MOCK_AMBULANCES = [
  {
    id: 'a1',
    regNo: 'RJ14 AB 1234',
    type: 'Basic Life Support (BLS)',
    distance: '2 min away',
    status: 'Available',
    rating: 4.8,
    available: true,
  },
  {
    id: 'a2',
    regNo: 'RJ14 CD 5678',
    type: 'Advanced Life Support (ALS)',
    distance: '4 min away',
    status: 'Available',
    rating: 4.7,
    available: true,
  },
  {
    id: 'a3',
    regNo: 'RJ14 EF 9012',
    type: 'Basic Life Support (BLS)',
    distance: '6 min away',
    status: 'Busy',
    rating: 4.5,
    available: false,
  },
  {
    id: 'a4',
    regNo: 'RJ14 GH 3456',
    type: 'ICU Ambulance',
    distance: '8 min away',
    status: 'Available',
    rating: 4.8,
    available: true,
  },
];

type TabKey = 'ambulances' | 'hospitals' | 'appointments';

// ─── Status color helper ──────────────────────────────────────────────────────
const requestStatusStyle = (status: string) => {
  if (status === 'RESOLVED' || status === 'CONFIRMED' || status === 'COMPLETED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-rose-100 text-rose-700';
  if (status === 'PENDING') return 'bg-amber-100 text-amber-700';
  if (['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(status)) return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
};

const requestStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    RESOLVED: 'Completed',
    CONFIRMED: 'Scheduled',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    PENDING: 'Pending',
    RECEIVED: 'Active',
    REVIEWING: 'Active',
    PREPARING: 'Active',
    AMBULANCE_COORDINATION: 'Active',
  };
  return map[status] ?? status;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const UserDashboardPage = () => {
  const navigate = useNavigate();
  const { currentLocation, location: geoLocation } = useLocationState();
  const [activeTab, setActiveTab] = useState<TabKey>('ambulances');

  // Location coords
  const userLat = geoLocation?.latitude ?? DEFAULT_JAIPUR_COORDINATES.latitude;
  const userLng = geoLocation?.longitude ?? DEFAULT_JAIPUR_COORDINATES.longitude;

  // ── Queries ──────────────────────────────────────────────────────────────
  const emergenciesQ = useQuery({
    queryKey: ['emergency-requests', 'dashboard'],
    queryFn: () => emergencyApi.list({ limit: 10 }),
    refetchInterval: 30_000,
  });

  const appointmentsQ = useQuery({
    queryKey: ['citizen-appointments', 'dashboard'],
    queryFn: () => hospitalAppointmentApi.listMyAppointments({ limit: 10 }),
  });

  const nearbyHospitalsQ = useQuery({
    queryKey: ['facilities', 'dashboard-nearby', userLat, userLng],
    queryFn: () =>
      facilityApi.search({ latitude: userLat, longitude: userLng, radiusMeters: 15000, limit: 6 }),
  });

  // ── Derived data ─────────────────────────────────────────────────────────
  const allEmergencies = emergenciesQ.data?.items ?? [];
  const activeEmergency = allEmergencies.find((e) =>
    ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(e.status)
  );
  const recentRequests = allEmergencies.slice(0, 4);

  const upcomingAppointment = (appointmentsQ.data?.items ?? []).find(
    (item: HospitalAppointment) => item.status === 'CONFIRMED' || item.status === 'PENDING'
  );

  const hospitals = nearbyHospitalsQ.data?.items ?? [];

  // ── Map markers ──────────────────────────────────────────────────────────
  const hospitalMarkers = useMemo(
    () =>
      hospitals
        .filter(
          (h) =>
            typeof (h as Facility & { latitude?: number }).latitude === 'number' &&
            typeof (h as Facility & { longitude?: number }).longitude === 'number'
        )
        .map((h) => ({
          id: h.id,
          latitude: (h as Facility & { latitude: number }).latitude,
          longitude: (h as Facility & { longitude: number }).longitude,
          title: h.name,
          type: 'HOSPITAL' as const,
          subtitle: h.type,
          isEmergency: true,
        })),
    [hospitals]
  );

  const userMarker = geoLocation
    ? [
        {
          id: 'user',
          latitude: geoLocation.latitude,
          longitude: geoLocation.longitude,
          title: 'Your Location',
          type: 'USER' as const,
          subtitle: currentLocation.label,
        },
      ]
    : [];

  const allMarkers = [...hospitalMarkers, ...userMarker];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ─── Active Emergency Alert Banner ─── */}
      {activeEmergency && (
        <div className="mx-4 mt-4 sm:mx-6 lg:mx-8 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 flex items-center justify-between gap-3 shadow-sm animate-pulse-subtle">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-rose-600 flex items-center justify-center shrink-0 animate-pulse">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-rose-800 uppercase tracking-wider">Active Emergency</p>
              <p className="text-sm font-bold text-slate-900">{activeEmergency.situationType}</p>
            </div>
          </div>
          <Link
            to={ROUTES.USER.TRACKING(activeEmergency.id)}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
          >
            <Navigation className="h-3.5 w-3.5" /> Track Live
          </Link>
        </div>
      )}

      {/* ─── Hero Banner ─── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 mx-4 mt-4 sm:mx-6 lg:mx-8 rounded-3xl shadow-xl">
        {/* background image overlay effect */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent" />
        {/* Ambulance illustration placeholder */}
        <div className="absolute right-0 top-0 bottom-0 w-2/5 hidden sm:flex items-center justify-center overflow-hidden rounded-r-3xl">
          <div className="text-[120px] select-none opacity-30">🚑</div>
        </div>

        <div className="relative z-10 px-6 py-8 sm:py-10 max-w-xl">
          <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-2">ResQ 2.0 · Jaipur, Rajasthan</p>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            Emergency care<br />just a tap away
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Fastest ambulance response, nearby hospitals and complete healthcare support.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              to={ROUTES.USER.EMERGENCY}
              className="flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/40 hover:bg-rose-700 transition-colors"
            >
              <Phone className="h-4 w-4" /> SOS Emergency
            </Link>
            <Link
              to={ROUTES.USER.AMBULANCES}
              className="flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 backdrop-blur px-5 py-3 text-sm font-bold text-white hover:bg-white/20 transition-colors"
            >
              <Ambulance className="h-4 w-4" /> Find Ambulance
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Quick Services Row ─── */}
      <div className="mx-4 mt-4 sm:mx-6 lg:mx-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: '🚑',
            label: 'Book Ambulance',
            sub: 'Get nearest ambulance in minutes',
            to: ROUTES.USER.AMBULANCES,
            color: 'border-red-200 hover:border-red-300',
          },
          {
            icon: '🏥',
            label: 'Nearby Hospitals',
            sub: 'Find hospitals and departments',
            to: ROUTES.USER.HOSPITALS,
            color: 'border-blue-200 hover:border-blue-300',
          },
          {
            icon: '📅',
            label: 'Book Appointment',
            sub: 'Schedule OPD & specialist visits',
            to: ROUTES.USER.APPOINTMENTS,
            color: 'border-emerald-200 hover:border-emerald-300',
          },
          {
            icon: '❤️',
            label: 'Health Services',
            sub: 'Lab tests, pharmacy and more',
            to: ROUTES.USER.HOSPITALS,
            color: 'border-purple-200 hover:border-purple-300',
          },
        ].map((svc) => (
          <Link
            key={svc.label}
            to={svc.to}
            className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-xs transition-all ${svc.color} hover:shadow-sm`}
          >
            <span className="text-2xl shrink-0">{svc.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900">{svc.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{svc.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ─── Main 2-col layout ─── */}
      <div className="mx-4 mt-4 sm:mx-6 lg:mx-8 flex flex-col xl:flex-row gap-4 pb-8">
        {/* LEFT: Map + Tabs ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Map */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex gap-2">
                {(['Map', 'Satellite'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                      v === 'Map'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3">
                {[
                  { dot: 'bg-blue-500', label: `Ambulances (${MOCK_AMBULANCES.filter((a) => a.available).length})` },
                  { dot: 'bg-red-500', label: `Hospitals (${hospitals.length || 28})` },
                  { dot: 'bg-emerald-500', label: 'Pharmacies (12)' },
                  { dot: 'bg-purple-500', label: 'Labs (8)' },
                ].map((l) => (
                  <span key={l.label} className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                    <span className={`h-2 w-2 rounded-full ${l.dot}`} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="h-[320px] w-full">
              {allMarkers.length > 0 ? (
                <MapView
                  center={{ latitude: userLat, longitude: userLng }}
                  zoom={12}
                  markers={allMarkers}
                  interactive
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400 gap-2">
                  <MapPin className="h-5 w-5" />
                  <span>Map loading — enabling location helps find nearby help faster</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs: Nearby Ambulances / Hospitals / Appointments */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-slate-100 px-4 pt-3 gap-1">
              {(
                [
                  { key: 'ambulances', label: 'Nearby Ambulances' },
                  { key: 'hospitals', label: 'Nearby Hospitals' },
                  { key: 'appointments', label: 'Book Appointment' },
                ] as { key: TabKey; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-t-xl px-4 py-2 text-xs font-bold transition-colors ${
                    activeTab === tab.key
                      ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/60'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-4">
              {activeTab === 'ambulances' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {MOCK_AMBULANCES.map((amb) => (
                    <div
                      key={amb.id}
                      className="rounded-2xl border border-slate-200 p-3 flex flex-col gap-2 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-3xl">🚑</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            amb.available ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {amb.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{amb.distance}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{amb.type}</p>
                        <p className="text-[11px] font-semibold text-slate-600 mt-1">{amb.regNo}</p>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="h-3 w-3 fill-current" />
                        <span className="text-[11px] font-bold text-slate-700">{amb.rating}</span>
                      </div>
                      <button
                        type="button"
                        disabled={!amb.available}
                        onClick={() => navigate(ROUTES.USER.AMBULANCES)}
                        className={`rounded-xl py-1.5 text-xs font-bold transition-colors ${
                          amb.available
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {amb.available ? 'Book Now' : 'Unavailable'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'hospitals' && (
                <div className="space-y-2">
                  {nearbyHospitalsQ.isLoading ? (
                    <div className="py-8 text-center">
                      <RefreshCw className="h-5 w-5 animate-spin text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Finding nearby hospitals…</p>
                    </div>
                  ) : hospitals.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-400">No hospitals found nearby. Try expanding search radius.</p>
                  ) : (
                    hospitals.map((h: Facility) => (
                      <Link
                        key={h.id}
                        to={ROUTES.USER.HOSPITAL_DETAIL(h.id)}
                        className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 hover:border-blue-200 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 shrink-0">
                            <Building2 className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{h.name}</p>
                            <p className="text-[11px] text-slate-500">{h.type} · {h.distance}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      </Link>
                    ))
                  )}
                  <Link
                    to={ROUTES.USER.HOSPITALS}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 transition mt-2"
                  >
                    View all nearby hospitals <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {activeTab === 'appointments' && (
                <div className="space-y-3">
                  {upcomingAppointment ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{upcomingAppointment.serviceDepartment}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {typeof upcomingAppointment.hospitalId === 'object' && upcomingAppointment.hospitalId
                              ? upcomingAppointment.hospitalId.name
                              : 'Hospital Facility'}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-600">
                            <Clock className="h-3 w-3" />
                            {upcomingAppointment.slotDate} at {upcomingAppointment.startTime}
                          </div>
                        </div>
                        <StatusBadge
                          variant={upcomingAppointment.status === 'CONFIRMED' ? 'verified' : 'waitTime'}
                          label={upcomingAppointment.status}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="py-4 text-center text-xs text-slate-400">No upcoming appointments.</p>
                  )}
                  <Link
                    to={ROUTES.USER.HOSPITALS}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition"
                  >
                    <Calendar className="h-4 w-4" /> Book New Appointment
                  </Link>
                  <Link
                    to={ROUTES.USER.APPOINTMENTS}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    View all appointments <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar panels ────────────────────────────────────────── */}
        <div className="w-full xl:w-80 shrink-0 space-y-4">
          {/* Your Location */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Your Location</p>
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[160px]">
                    {currentLocation.label || 'Mansarovar, Jaipur, Rajasthan'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                Change
              </button>
            </div>
          </div>

          {/* Emergency SOS CTA */}
          <Link
            to={ROUTES.USER.EMERGENCY}
            className="block rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 hover:bg-rose-100 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-600 flex items-center justify-center animate-pulse group-hover:scale-105 transition-transform">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-black text-rose-900">Emergency SOS</p>
                  <p className="text-[11px] text-rose-600 font-medium">Get immediate help • 24×7</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4">
            <h3 className="text-xs font-bold text-slate-800 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: <Phone className="h-5 w-5" />, label: 'Call 108', bg: 'bg-emerald-50 text-emerald-700', action: () => { window.location.href = 'tel:108'; } },
                { icon: <Share2 className="h-5 w-5" />, label: 'Share Live Location', bg: 'bg-blue-50 text-blue-700', action: () => { void navigator.share?.({ title: 'My Location', text: currentLocation.label }); } },
                { icon: <Users className="h-5 w-5" />, label: 'Add Emergency Contacts', bg: 'bg-purple-50 text-purple-700', to: ROUTES.USER.PROFILE },
                { icon: <FileText className="h-5 w-5" />, label: 'View Health Records', bg: 'bg-amber-50 text-amber-700', to: ROUTES.USER.PROFILE },
              ].map((qa, i) => {
                const inner = (
                  <div className={`flex flex-col items-center gap-1.5 rounded-xl p-2 ${qa.bg}`}>
                    {qa.icon}
                    <p className="text-[9px] font-bold text-center leading-tight">{qa.label}</p>
                  </div>
                );
                return qa.to ? (
                  <Link key={i} to={qa.to}>{inner}</Link>
                ) : (
                  <button key={i} type="button" onClick={qa.action}>{inner}</button>
                );
              })}
            </div>
          </div>

          {/* Recent Requests */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800">Recent Requests</h3>
              <Link to={ROUTES.USER.HISTORY} className="text-[11px] font-bold text-blue-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {emergenciesQ.isLoading ? (
                <div className="py-6 text-center">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-300 mx-auto mb-1" />
                  <p className="text-[11px] text-slate-400">Loading…</p>
                </div>
              ) : recentRequests.length === 0 ? (
                // Show mock data if no real data
                [
                  { icon: '🚑', label: 'Ambulance Request', date: '12 Oct 2026, 4:32 PM', status: 'RESOLVED' },
                  { icon: '📅', label: 'Hospital Appointment', date: '10 Oct 2026, 11:00 AM', status: 'CONFIRMED' },
                  { icon: <Beaker className="h-4 w-4" />, label: 'Lab Test Booking', date: '5 Oct 2026, 9:15 AM', status: 'RESOLVED' },
                  { icon: '🚑', label: 'Ambulance Request', date: '2 Oct 2026, 8:20 PM', status: 'CANCELLED' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{typeof item.icon === 'string' ? item.icon : item.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.date}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${requestStatusStyle(item.status)}`}>
                      {requestStatusLabel(item.status)}
                    </span>
                  </div>
                ))
              ) : (
                recentRequests.map((req) => (
                  <Link
                    key={req.id}
                    to={ROUTES.USER.TRACKING(req.id)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{req.situationType}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(req.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${requestStatusStyle(req.status)}`}>
                      {requestStatusLabel(req.status)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Emergency Numbers */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-4">
            <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-rose-600" /> Indian Emergency Numbers
            </h3>
            <div className="space-y-2">
              {[
                { label: 'Police', no: '100', color: 'text-blue-700' },
                { label: 'Fire', no: '101', color: 'text-orange-700' },
                { label: 'Ambulance', no: '102', color: 'text-emerald-700' },
                { label: 'National Emergency', no: '112', color: 'text-red-700' },
                { label: 'Govt Ambulance', no: '108', color: 'text-rose-700' },
                { label: 'Women Helpline', no: '181', color: 'text-purple-700' },
              ].map((n) => (
                <a
                  key={n.no}
                  href={`tel:${n.no}`}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 hover:bg-slate-100 transition"
                >
                  <span className="text-xs font-semibold text-slate-700">{n.label}</span>
                  <span className={`text-sm font-black ${n.color}`}>{n.no}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
