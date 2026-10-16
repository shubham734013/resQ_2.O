import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  AlertTriangle,
  Users,
  BedDouble,
  Calendar,
  MapPin,
  Clock,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Phone,
  Bell,
  BarChart3,
  ChevronRight,
  Activity,
  Ambulance,
  UserCheck,
  FileText,
  Radio,
  Megaphone,
  ToggleRight,
  Stethoscope,
} from 'lucide-react';
import { MapView } from '../../components/map/MapView';
import { hospitalApi } from '../../services/hospitalApi';
import { useHospitalProfile } from '../../hooks/useHospitalManagement';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes/routePaths';
import { Button } from '../../components/common/Button';

/* ─── Priority helpers ─────────────────────────────────────────────── */
const priorityFor = (situationType: string) => {
  const s = situationType.toLowerCase();
  if (/accident|chest|stroke|unconscious|severe|critical/.test(s))
    return { label: 'Critical', bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' };
  if (/breathing|burn|high/.test(s))
    return { label: 'High', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
  if (/maternity|medium/.test(s))
    return { label: 'Medium', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400' };
  return { label: 'Low', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
};

const timeAgo = (dateStr: string) => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff === 1) return '1 min ago';
  return `${diff} min ago`;
};

/* ─── Department bed data (derived from resourceSummary) ───────────── */
const DEPT_CONFIG = [
  { key: 'ICU', label: 'ICU', total: 20 },
  { key: 'General Ward', label: 'General Ward', total: 60 },
  { key: 'Emergency', label: 'Emergency', total: 20 },
  { key: 'Private Rooms', label: 'Private Rooms', total: 10 },
  { key: 'Isolation', label: 'Isolation', total: 10 },
];

/* ─── Department status pills ───────────────────────────────────────── */
const DEPT_STATUS = [
  { name: 'Emergency', patients: 8, status: 'Busy', color: 'bg-rose-100 text-rose-700' },
  { name: 'ICU', beds: '12 / 20', status: '75%', color: 'bg-amber-100 text-amber-700' },
  { name: 'General Medicine', patients: 18, status: 'Moderate', color: 'bg-amber-100 text-amber-700' },
  { name: 'Surgery', patients: 6, status: 'Available', color: 'bg-emerald-100 text-emerald-700' },
  { name: 'Pediatrics', patients: 4, status: 'Available', color: 'bg-emerald-100 text-emerald-700' },
];

/* ─── On-Duty staff (static placeholder — replace with real API when ready) */
const ON_DUTY_STAFF = [
  { name: 'Dr. Ankit Sharma', dept: 'Emergency', status: 'Online', avatar: 'AS' },
  { name: 'Dr. Priya Singh', dept: 'Cardiology', status: 'Online', avatar: 'PS' },
  { name: 'Dr. Rohan Mehta', dept: 'Orthopedics', status: 'Online', avatar: 'RM' },
  { name: 'Dr. Neha Verma', dept: 'Pediatrics', status: 'On Leave', avatar: 'NV' },
];

/* ─── Today's appointments (static placeholder) ───────────────────── */
const TODAY_APPTS = [
  { time: '09:00 AM', title: 'OPD – General Medicine', patient: 'Rahul Sharma', status: 'Checked In' },
  { time: '10:30 AM', title: 'Cardiology Consultation', patient: 'Priya Mehta', status: 'Upcoming' },
  { time: '11:00 AM', title: 'Orthopedics Follow-up', patient: 'Amit Kumar', status: 'Upcoming' },
  { time: '12:30 PM', title: 'Pediatrics Consultation', patient: 'Neha Gupta', status: 'Upcoming' },
];

/* ═══════════════════════════════════════════════════════════════════ */
export const HospitalDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'All' | 'Emergency' | 'Transfer' | 'Appointment'>('All');
  const [mapType, setMapType] = useState<'Map' | 'Satellite'>('Map');

  /* API queries */
  const profile = useHospitalProfile();
  const emergencies = useQuery({
    queryKey: ['hospital', 'emergencies', { limit: 20 }],
    queryFn: () => hospitalApi.getEmergencies({ limit: 20 }),
    refetchInterval: 15000,
  });
  const patients = useQuery({
    queryKey: ['hospital', 'patients', { limit: 5 }],
    queryFn: () => hospitalApi.getPatients({ limit: 5 }),
  });
  const ambulances = useQuery({
    queryKey: ['hospital', 'ambulances', { limit: 10 }],
    queryFn: () => hospitalApi.getAmbulances({ limit: 10 }),
  });
  const summary = useQuery({
    queryKey: ['hospital', 'summary'],
    queryFn: hospitalApi.getEmergencySummary,
    refetchInterval: 30000,
  });

  /* Derived */
  const hospitalName = profile.data?.name || user?.name || 'Hospital';
  const city = profile.data?.city || 'Jaipur';
  const state = profile.data?.state || 'Rajasthan';
  const isOnline = profile.data?.emergencyAvailability === 'AVAILABLE' || profile.data?.emergencyAvailability === 'LIMITED';
  const hospitalLat = profile.data?.latitude;
  const hospitalLng = profile.data?.longitude;

  const allEmergencies = emergencies.data?.items ?? [];
  const activeEmergencies = allEmergencies.filter(
    (e) => !['RESOLVED', 'CANCELLED'].includes(e.status),
  );
  const totalPatients = patients.data?.pagination.total ?? 0;
  const resources = profile.data?.resourceSummary ?? {};
  const totalBeds = Object.values(resources).reduce((a, b) => a + b, 0) || 120;
  const occupiedBeds = Math.round(totalBeds * 0.57);
  const availableBeds = totalBeds - occupiedBeds;

  const filteredRequests = useMemo(() => {
    if (activeTab === 'All') return allEmergencies.slice(0, 8);
    if (activeTab === 'Emergency') return activeEmergencies.slice(0, 5);
    return allEmergencies.slice(0, 3);
  }, [activeTab, allEmergencies, activeEmergencies]);

  /* Map markers from nearby ambulances */
  const ambulanceMarkers = useMemo(() =>
    (ambulances.data?.items ?? [])
      .filter((a) => typeof a.currentLatitude === 'number' && typeof a.currentLongitude === 'number')
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        latitude: a.currentLatitude!,
        longitude: a.currentLongitude!,
        title: a.vehicleNumber,
        subtitle: a.ambulanceType,
        isEmergency: false,
      })),
  [ambulances.data]);

  const hospitalMarker = hospitalLat && hospitalLng
    ? [{ id: 'hospital', type: 'HOSPITAL' as const, latitude: hospitalLat, longitude: hospitalLng, title: hospitalName, subtitle: 'Your Hospital', isEmergency: false }]
    : [];

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="w-full space-y-5 px-4 py-5 sm:px-6 lg:px-8">

        {/* ── Hero Banner ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-teal-900 text-white">
          <div className="relative z-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-sm font-semibold text-teal-300 mb-1">Hospital Panel · {hospitalName}</p>
              <h1 className="text-2xl sm:text-3xl font-black">Welcome, {hospitalName}</h1>
              <p className="mt-1 text-sm text-slate-300 max-w-lg">
                Manage emergency requests, patient appointments, beds, and hospital operations efficiently.
              </p>
            </div>
            {/* Date/Time card */}
            <div className="shrink-0 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-5 py-3 text-right">
              <p className="text-xs text-slate-300">{dateStr}</p>
              <p className="text-3xl font-black tracking-tight">{timeStr}</p>
              <p className="text-xs text-slate-300 mt-0.5">☁ 26°C · {city}, {state}</p>
            </div>
          </div>
          {/* Decorative building */}
          <div className="absolute right-0 top-0 h-full w-1/4 opacity-10 flex items-center justify-end pr-4">
            <Building2 className="h-32 w-32" />
          </div>
        </div>

        {/* ── 4 Stats Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Emergency Requests */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">Emergency Requests</p>
                <p className="mt-1 text-3xl font-black text-slate-900">{activeEmergencies.length || 12}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">+4 new today · <span className="text-rose-500">↓ 33%</span></p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100">
                <AlertTriangle className="h-5 w-5 text-rose-600 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Total Patients */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">Total Patients</p>
                <p className="mt-1 text-3xl font-black text-slate-900">{totalPatients || 248}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">+18 today · <span className="text-emerald-500">↑ 12%</span></p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Available Beds */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">Available Beds</p>
                <p className="mt-1 text-3xl font-black text-slate-900">{availableBeds} <span className="text-lg font-semibold text-slate-400">/ {totalBeds}</span></p>
                <p className="text-[10px] text-slate-400 mt-0.5">{Math.round((occupiedBeds / totalBeds) * 100)}% occupied</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                <BedDouble className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Today's Appointments */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">Today's Appointments</p>
                <p className="mt-1 text-3xl font-black text-slate-900">36</p>
                <p className="text-[10px] text-slate-400 mt-0.5">+8 upcoming · <span className="text-emerald-500">↑ 20%</span></p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Content Grid ────────────────────────────────────── */}
        <div className="grid gap-5 xl:grid-cols-5">

          {/* ── Left: Live Requests + Beds + Staff (3 cols) ─────── */}
          <div className="xl:col-span-3 space-y-5">

            {/* Live Incoming Requests */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">Live Incoming Requests</h2>
                <button
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                  onClick={() => navigate(ROUTES.HOSPITAL.REQUESTS)}
                >
                  View All
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-5 pt-3 pb-1">
                {(['All', 'Emergency', 'Transfer', 'Appointment'] as const).map((tab) => {
                  const count = tab === 'All' ? allEmergencies.length || 12
                    : tab === 'Emergency' ? activeEmergencies.length || 5
                    : tab === 'Transfer' ? 3
                    : 4;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        activeTab === tab
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab} <span className={`text-[10px] ${activeTab === tab ? 'text-blue-200' : 'text-slate-400'}`}>({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Request rows */}
              <div className="divide-y divide-slate-100 px-5 pb-2">
                {emergencies.isLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    Loading requests…
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No active requests</p>
                  </div>
                ) : (
                  filteredRequests.map((req) => {
                    const priority = priorityFor(req.situationType);
                    return (
                      <div key={req.id} className="flex items-center gap-3 py-3">
                        {/* Priority icon */}
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${priority.bg}`}>
                          <AlertTriangle className={`h-4 w-4 ${priority.text}`} />
                        </div>
                        {/* Priority badge */}
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${priority.bg} ${priority.text}`}>
                          {priority.label}
                        </span>
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{req.situationType}</p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            {req.location || `${city}, ${state}`}
                          </p>
                        </div>
                        {/* Time */}
                        <div className="shrink-0 flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          {timeAgo(req.reportedAt)}
                        </div>
                        {/* Accept */}
                        <Button
                          size="sm"
                          variant="primary"
                          className="shrink-0 bg-blue-600 hover:bg-blue-700 text-[11px] px-3 h-7"
                          onClick={() => navigate(`${ROUTES.HOSPITAL.REQUESTS}/${req.id}`)}
                        >
                          Accept
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bed Occupancy + Department Beds + On Duty */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Bed Occupancy donut */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:col-span-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Bed Occupancy</h3>
                  <button
                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                    onClick={() => navigate(ROUTES.HOSPITAL.AVAILABILITY)}
                  >
                    Manage Beds
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-1">Total Beds</p>
                <p className="text-2xl font-black text-slate-900 mb-3">{totalBeds}</p>

                {/* Simple visual ring */}
                <div className="flex items-center justify-center my-3">
                  <div className="relative h-24 w-24">
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#ef4444" strokeWidth="3"
                        strokeDasharray={`${Math.round((occupiedBeds / totalBeds) * 100)} 100`}
                        strokeLinecap="round"
                      />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#22c55e" strokeWidth="3"
                        strokeDasharray={`${Math.round((availableBeds / totalBeds) * 100)} 100`}
                        strokeDashoffset={`${-Math.round((occupiedBeds / totalBeds) * 100)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-lg font-black text-slate-900">{Math.round((occupiedBeds / totalBeds) * 100)}%</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Occupied</span>
                    <span className="font-bold">{occupiedBeds}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Available</span>
                    <span className="font-bold">{availableBeds}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" />Maintenance</span>
                    <span className="font-bold">0</span>
                  </div>
                </div>
              </div>

              {/* Department Beds */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:col-span-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Department Wise Beds</h3>
                  <button className="text-[10px] font-semibold text-blue-600 hover:underline">View All</button>
                </div>
                <div className="space-y-3">
                  {DEPT_CONFIG.map((dept) => {
                    const occupied = Math.round((resources[dept.key] ?? dept.total) * 0.6);
                    const pct = Math.round((occupied / dept.total) * 100);
                    const barColor = pct >= 80 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : 'bg-blue-500';
                    return (
                      <div key={dept.key}>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <span className="text-slate-700 font-medium">{dept.label}</span>
                          <span className="text-slate-500">{occupied} / {dept.total}</span>
                          <span className={`font-bold ${pct >= 80 ? 'text-rose-600' : pct >= 60 ? 'text-amber-600' : 'text-blue-600'}`}>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* On Duty Staff */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:col-span-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">On Duty Staff</h3>
                  <button className="text-[10px] font-semibold text-blue-600 hover:underline">View All</button>
                </div>
                <div className="space-y-3">
                  {ON_DUTY_STAFF.map((staff) => (
                    <div key={staff.name} className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                        {staff.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{staff.name}</p>
                        <p className="text-[10px] text-slate-500">{staff.dept}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        staff.status === 'Online' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {staff.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Map + Hospital Status + Quick Actions + Appointments + Dept Status (2 cols) ── */}
          <div className="xl:col-span-2 space-y-5">

            {/* Hospital Status & toggle */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Hospital Status</h3>
                  <p className={`text-xs font-semibold mt-1 flex items-center gap-1.5 ${isOnline ? 'text-emerald-600' : 'text-slate-500'}`}>
                    <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {isOnline ? 'Online & Receiving Requests' : 'Offline – Not Accepting'}
                  </p>
                </div>
                <div className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full transition-colors ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isOnline ? 'translate-x-5' : ''}`} />
                </div>
              </div>
            </div>

            {/* Nearby Ambulances & Route – Map */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <h3 className="text-sm font-bold text-slate-900">Nearby Ambulances & Route</h3>
                <button
                  className="text-[10px] font-semibold text-blue-600 hover:underline"
                  onClick={() => navigate(ROUTES.HOSPITAL.EMERGENCY)}
                >
                  View All Ambulances
                </button>
              </div>
              {/* Map/Satellite tabs */}
              <div className="flex gap-1 px-4 pb-2">
                {(['Map', 'Satellite'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMapType(t)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      mapType === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {/* Map */}
              <div className="h-[260px]">
                <MapView
                  markers={[...ambulanceMarkers, ...hospitalMarker]}
                  center={hospitalLat && hospitalLng ? { latitude: hospitalLat, longitude: hospitalLng } : undefined}
                  interactive
                  className="h-full w-full"
                />
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-rose-500" />Hospitals</span>
                <span className="flex items-center gap-1"><Ambulance className="h-3 w-3 text-amber-500" />Ambulances</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-blue-500" />Your Hospital</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: BedDouble, label: 'Update Bed\nAvailability', color: 'bg-blue-100 text-blue-600', path: ROUTES.HOSPITAL.AVAILABILITY },
                  { icon: Calendar, label: 'Manage\nAppointments', color: 'bg-rose-100 text-rose-600', path: ROUTES.HOSPITAL.APPOINTMENTS },
                  { icon: Building2, label: 'Add\nDepartment', color: 'bg-indigo-100 text-indigo-600', path: ROUTES.HOSPITAL.SERVICES },
                  { icon: FileText, label: 'View Patient\nRecords', color: 'bg-purple-100 text-purple-600', path: ROUTES.HOSPITAL.PATIENTS },
                  { icon: Ambulance, label: 'Request\nAmbulance', color: 'bg-amber-100 text-amber-600', path: ROUTES.HOSPITAL.EMERGENCY },
                  { icon: Megaphone, label: 'Broadcast\nNotification', color: 'bg-teal-100 text-teal-600', path: ROUTES.HOSPITAL.NOTIFICATIONS },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className="flex flex-col items-center gap-1.5 rounded-xl p-2.5 hover:bg-slate-50 transition"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 text-center leading-tight whitespace-pre-line">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Today's Appointments */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Today's Appointments</h3>
                <button
                  className="text-[10px] font-semibold text-blue-600 hover:underline"
                  onClick={() => navigate(ROUTES.HOSPITAL.APPOINTMENTS)}
                >
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {TODAY_APPTS.map((appt) => (
                  <div key={appt.time} className="flex items-start gap-3">
                    <div className="shrink-0 text-center">
                      <p className="text-[10px] font-bold text-slate-700">{appt.time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{appt.title}</p>
                      <p className="text-[10px] text-slate-500">{appt.patient}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      appt.status === 'Checked In' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {appt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Status */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Department Status</h3>
                <button className="text-[10px] font-semibold text-blue-600 hover:underline">View All</button>
              </div>
              <div className="space-y-2.5">
                {DEPT_STATUS.map((dept) => (
                  <div key={dept.name} className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${dept.color.split(' ')[0]}`}>
                      <Stethoscope className={`h-4 w-4 ${dept.color.split(' ')[1]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{dept.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {'patients' in dept ? `${dept.patients as number} patients` : dept.beds}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${dept.color}`}>
                      {dept.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Need Help card */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-900">Need Help?</p>
                  <p className="text-[10px] text-blue-700">Contact ResQ Support</p>
                </div>
                <a
                  href="tel:112"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
