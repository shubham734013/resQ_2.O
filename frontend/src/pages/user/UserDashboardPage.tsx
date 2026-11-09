import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
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
  Zap,
  HeartPulse,
  Activity,
  ArrowUpRight,
  PhoneCall,
} from 'lucide-react';
import { emergencyApi } from '../../services/emergencyApi';
import { hospitalAppointmentApi, type HospitalAppointment } from '../../services/hospitalAppointmentApi';
import { facilityApi } from '../../services/facilityApi';
import type { Facility } from '../../types/facility';
import { ROUTES } from '../../routes/routePaths';
import { StatusBadge } from '../../components/common/StatusBadge';
import { MapView } from '../../components/map/MapView';
import { darkMapStyle } from '../../components/map/darkMapStyle';
import { DEFAULT_JAIPUR_COORDINATES } from '../../types/maps';
import { useLocationState } from '../../hooks/useLocationState';

// ─── Nearby Ambulances Telemetry ─────────────────────────────────────────────
const MOCK_AMBULANCES = [
  { id: 'a1', regNo: 'RJ14 AB 1234', type: 'Basic Life Support (BLS)', distance: '2 min away', status: 'Available', rating: 4.8, available: true },
  { id: 'a2', regNo: 'RJ14 CD 5678', type: 'Advanced Life Support (ALS)', distance: '4 min away', status: 'Available', rating: 4.7, available: true },
  { id: 'a3', regNo: 'RJ14 EF 9012', type: 'Basic Life Support (BLS)', distance: '6 min away', status: 'Busy', rating: 4.5, available: false },
  { id: 'a4', regNo: 'RJ14 GH 3456', type: 'ICU Ambulance', distance: '8 min away', status: 'Available', rating: 4.8, available: true },
];

type TabKey = 'ambulances' | 'hospitals' | 'appointments';

const requestStatusStyle = (status: string): string => {
  if (status === 'RESOLVED' || status === 'CONFIRMED' || status === 'COMPLETED') return 'pill-active';
  if (status === 'CANCELLED') return 'pill-critical';
  if (status === 'PENDING') return 'pill-warning';
  if (['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(status)) return 'pill-info';
  return 'pill-neutral';
};

const requestStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    RESOLVED: 'Resolved',
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

// ─── Obsidian Dark Glass Container ──────────────────────────────────────────
const DarkGlassCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all duration-300 shadow-xl ${className}`}
  >
    {children}
  </div>
);

// ─── Main Citizen Dashboard Component ───────────────────────────────────────
export const UserDashboardPage = () => {
  const navigate = useNavigate();
  const { currentLocation, location: geoLocation, refreshLocation, isUpdating } = useLocationState();
  const [activeTab, setActiveTab] = useState<TabKey>('ambulances');

  const userLat = geoLocation?.latitude ?? DEFAULT_JAIPUR_COORDINATES.latitude;
  const userLng = geoLocation?.longitude ?? DEFAULT_JAIPUR_COORDINATES.longitude;

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
    queryFn: () => facilityApi.search({ latitude: userLat, longitude: userLng, radiusMeters: 15000, limit: 6 }),
  });

  const allEmergencies = emergenciesQ.data?.items ?? [];
  const activeEmergency = allEmergencies.find((e) =>
    ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(e.status)
  );
  const recentRequests = allEmergencies.slice(0, 4);
  const upcomingAppointment = (appointmentsQ.data?.items ?? []).find(
    (item: HospitalAppointment) => item.status === 'CONFIRMED' || item.status === 'PENDING'
  );
  const hospitals = useMemo(() => nearbyHospitalsQ.data?.items ?? [], [nearbyHospitalsQ.data?.items]);

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
    <div className="flex-1 bg-[#08090a] text-zinc-100 font-sans p-4 sm:p-6 lg:p-8 space-y-6">

      {/* ─── Active Emergency Alert (if in progress) ───────────────────────── */}
      {activeEmergency && (
        <div className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-rose-500/10 border border-rose-500/30 backdrop-blur-xl shadow-2xl shadow-rose-950/40">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center shrink-0 shadow-lg shadow-rose-950/60 animate-pulse">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                  Critical Emergency Active
                </p>
              </div>
              <p className="text-sm font-bold text-white mt-0.5">{activeEmergency.situationType}</p>
              <p className="text-xs text-zinc-400">Paramedic dispatch in progress · Telemetry relay open</p>
            </div>
          </div>
          <Link
            to={ROUTES.USER.TRACKING(activeEmergency.id)}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-950/60 transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <Navigation className="h-4 w-4" />
            <span>Track Live Dispatch</span>
          </Link>
        </div>
      )}

      {/* ─── Hero Overview Banner ─────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900/60 to-zinc-950 border border-white/10 p-6 sm:p-10 shadow-2xl">
        {/* Ambient atmospheric glows */}
        <div
          className="absolute -top-20 -right-20 h-72 w-72 rounded-full pointer-events-none opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-20 left-1/3 h-64 w-64 rounded-full pointer-events-none opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-zinc-300 mb-4 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span>resQ 2.O · Jaipur Metropolitan Healthcare Grid</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-white leading-tight mb-3">
            Emergency medical care, <br />
            <span className="font-bold bg-gradient-to-r from-rose-400 via-rose-300 to-amber-300 bg-clip-text text-transparent">
              just a tap away
            </span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed mb-6 max-w-xl">
            Sub-second paramedic dispatch, verified emergency hospitals, and 24×7 rapid care response across Jaipur jurisdiction.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={ROUTES.USER.EMERGENCY}
              className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-black text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 shadow-xl shadow-rose-950/60 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>SOS Emergency Dispatch</span>
            </Link>

            <Link
              to={ROUTES.USER.AMBULANCES}
              className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-zinc-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 backdrop-blur-md transition-all cursor-pointer"
            >
              <Ambulance className="h-4 w-4 text-rose-400" />
              <span>Find Nearby Ambulance</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 4 Quick Service Bento Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: Ambulance,
            label: 'Emergency Ambulance',
            sub: 'Instant 1-tap dispatch with live GPS telemetry',
            badge: 'Instant Dispatch',
            to: ROUTES.USER.EMERGENCY,
          },
          {
            icon: Building2,
            label: 'Nearby Hospitals',
            sub: 'Verified 24/7 emergency & trauma facilities',
            badge: `${hospitals.length || 28} Verified`,
            to: ROUTES.USER.HOSPITALS,
          },
          {
            icon: Calendar,
            label: 'Doctor Appointments',
            sub: 'Schedule OPD, specialist & consult visits',
            badge: 'Online Booking',
            to: ROUTES.USER.APPOINTMENTS,
          },
          {
            icon: HeartPulse,
            label: 'Care Inquiries',
            sub: 'Direct hospital support & patient triage',
            badge: 'Direct Connect',
            to: ROUTES.USER.REQUESTS,
          },
        ].map((svc) => {
          const Icon = svc.icon;
          return (
            <Link
              key={svc.label}
              to={svc.to}
              className="group relative flex flex-col justify-between bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300 shadow-xl hover:shadow-rose-950/30"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  {/* Icon Styling: Translucent glowing badge */}
                  <div className="bg-rose-500/10 text-rose-400 p-2.5 rounded-xl border border-rose-500/20 group-hover:bg-rose-500/20 transition-all duration-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 border border-white/10">
                    {svc.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-rose-200 transition-colors">
                  {svc.label}
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  {svc.sub}
                </p>
              </div>

              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-rose-400 group-hover:text-rose-300 pt-3 border-t border-white/[0.06]">
                <span>Launch Service</span>
                <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* ─── Main 2-Column Workspace Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Native Google Maps + Segmented Feed (8 Cols) ──────── */}
        <div className="xl:col-span-8 space-y-6">

          {/* Map Container Frame: Encase Google Maps in dark glass frame */}
          <div className="relative border border-white/10 rounded-2xl overflow-hidden shadow-2xl bg-zinc-950/90 h-[430px] w-full">
            {allMarkers.length > 0 ? (
              <MapView
                center={{ latitude: userLat, longitude: userLng }}
                zoom={12}
                markers={allMarkers}
                interactive
                options={{ styles: darkMapStyle }}
                styles={darkMapStyle}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-zinc-400 bg-zinc-950">
                <MapPin className="h-6 w-6 text-rose-500 animate-bounce" />
                <p>Initializing native dark mode navigation map…</p>
              </div>
            )}

            {/* Floating Overlay Badges: Position live count indicators on top of map */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
              {/* Ambulances Badge */}
              <div className="bg-zinc-950/80 border border-white/10 backdrop-blur-md text-xs text-zinc-300 rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="font-semibold text-zinc-200">Ambulances</span>
                <span className="font-mono text-[11px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20">
                  {MOCK_AMBULANCES.filter((a) => a.available).length}
                </span>
              </div>

              {/* Hospitals Badge */}
              <div className="bg-zinc-950/80 border border-white/10 backdrop-blur-md text-xs text-zinc-300 rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span className="font-semibold text-zinc-200">Hospitals</span>
                <span className="font-mono text-[11px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20">
                  {hospitals.length || 28}
                </span>
              </div>

              {/* Pharmacies Badge */}
              <div className="hidden sm:flex items-center gap-2 bg-zinc-950/80 border border-white/10 backdrop-blur-md text-xs text-zinc-300 rounded-xl px-3 py-1.5 shadow-xl">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span className="font-semibold text-zinc-200">Pharmacies</span>
                <span className="font-mono text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                  12
                </span>
              </div>

              {/* Labs Badge */}
              <div className="hidden sm:flex items-center gap-2 bg-zinc-950/80 border border-white/10 backdrop-blur-md text-xs text-zinc-300 rounded-xl px-3 py-1.5 shadow-xl">
                <span className="h-2 w-2 rounded-full bg-purple-400"></span>
                <span className="font-semibold text-zinc-200">Labs</span>
                <span className="font-mono text-[11px] text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded-md border border-purple-500/20">
                  8
                </span>
              </div>
            </div>

            {/* Bottom Floating Telemetry Strip */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-zinc-950/80 border border-white/10 backdrop-blur-md p-1 rounded-xl shadow-xl">
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 border border-rose-500/30 rounded-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                Native Dark Obsidian Map
              </span>
              <span className="px-2 py-1 text-[11px] text-zinc-400 font-medium hidden sm:inline">
                Jaipur Sector 1-12
              </span>
            </div>
          </div>

          {/* Tab Navigation & Feed */}
          <DarkGlassCard className="p-6">
            {/* Segmented Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
              <div className="flex items-center gap-1 bg-white/[0.04] border border-white/10 p-1 rounded-xl backdrop-blur-md">
                {(
                  [
                    { key: 'ambulances', label: 'Nearby Ambulances' },
                    { key: 'hospitals', label: 'Nearby Hospitals' },
                    { key: 'appointments', label: 'Book Appointment' },
                  ] as { key: TabKey; label: string }[]
                ).map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Activity className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                <span>Live Feed Updates Active</span>
              </div>
            </div>

            {/* Tab Feed Content */}
            <div className="pt-5">
              {/* 1. Ambulances Tab Feed */}
              {activeTab === 'ambulances' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {MOCK_AMBULANCES.map((amb) => (
                    <div
                      key={amb.id}
                      className="rounded-2xl p-4.5 bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-200 flex flex-col justify-between gap-3 shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                              <Ambulance className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{amb.regNo}</p>
                              <p className="text-xs text-zinc-400">{amb.type}</p>
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              amb.available ? 'pill-active' : 'pill-warning'
                            }`}
                          >
                            {amb.status}
                          </span>
                        </div>

                        <div className="mt-3.5 flex items-center justify-between text-xs text-zinc-300 pt-3 border-t border-white/[0.06]">
                          <span className="font-semibold text-rose-300 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {amb.distance}
                          </span>
                          <span className="flex items-center gap-1 text-amber-400 font-bold">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {amb.rating}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!amb.available}
                        onClick={() => navigate(ROUTES.USER.EMERGENCY)}
                        className={`w-full rounded-xl py-2.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                          amb.available
                            ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white shadow-lg shadow-rose-950/50 active:scale-95'
                            : 'bg-white/[0.04] text-zinc-500 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        {amb.available ? 'Request Immediate Dispatch' : 'Unit Assigned'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. Hospitals Tab Feed */}
              {activeTab === 'hospitals' && (
                <div className="space-y-3">
                  {nearbyHospitalsQ.isLoading ? (
                    <div className="py-12 text-center text-zinc-400">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-rose-400" />
                      <p className="text-xs font-semibold">Scanning nearby healthcare facilities…</p>
                    </div>
                  ) : hospitals.length === 0 ? (
                    <p className="py-10 text-center text-xs text-zinc-400">
                      No hospitals found in immediate vicinity. Expand search radius.
                    </p>
                  ) : (
                    hospitals.map((h: Facility) => (
                      <Link
                        key={h.id}
                        to={ROUTES.USER.HOSPITAL_DETAIL(h.id)}
                        className="flex items-center justify-between rounded-xl p-3.5 bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 group-hover:bg-rose-500/20 transition-colors">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white group-hover:text-rose-200 transition-colors">
                              {h.name}
                            </p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {h.type} · {h.distance || 'Jaipur Central'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            24/7 ER
                          </span>
                          <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
                        </div>
                      </Link>
                    ))
                  )}

                  <Link
                    to={ROUTES.USER.HOSPITALS}
                    className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all mt-4"
                  >
                    <span>View All Healthcare Facilities</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* 3. Appointments Tab Feed */}
              {activeTab === 'appointments' && (
                <div className="space-y-4">
                  {upcomingAppointment ? (
                    <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                              Confirmed Appointment
                            </p>
                          </div>
                          <p className="text-sm font-bold text-white mt-1">
                            {upcomingAppointment.serviceDepartment}
                          </p>
                          <p className="text-xs text-zinc-300 mt-0.5">
                            {typeof upcomingAppointment.hospitalId === 'object' && upcomingAppointment.hospitalId
                              ? upcomingAppointment.hospitalId.name
                              : 'Hospital Facility'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2.5 text-xs text-zinc-400">
                            <Clock className="h-3.5 w-3.5 text-emerald-400" />
                            <span>{upcomingAppointment.slotDate} at {upcomingAppointment.startTime}</span>
                          </div>
                        </div>

                        <StatusBadge
                          variant={upcomingAppointment.status === 'CONFIRMED' ? 'verified' : 'waitTime'}
                          label={upcomingAppointment.status}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-zinc-400">
                      <Calendar className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                      <p>No upcoming appointments found.</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Link
                      to={ROUTES.USER.HOSPITALS}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-950/50 transition-all"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Book New Appointment</span>
                    </Link>
                    <Link
                      to={ROUTES.USER.APPOINTMENTS}
                      className="flex items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-xs font-semibold text-zinc-300 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all"
                    >
                      <span>Appointment History</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </DarkGlassCard>
        </div>

        {/* RIGHT COLUMN: Location, Dedicated SOS, Telemetry & Quick Bento (4 Cols) ─── */}
        <div className="xl:col-span-4 space-y-6">

          {/* Location Telemetry Card */}
          <DarkGlassCard className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-rose-500/10 text-rose-400 p-2.5 rounded-xl border border-rose-500/20 shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">GPS Live Telemetry</p>
                  </div>
                  <p className="text-xs font-semibold text-white truncate max-w-[180px] mt-0.5">
                    {currentLocation.label || 'Jaipur Metropolitan, Rajasthan'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={refreshLocation}
                disabled={isUpdating}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer shrink-0"
              >
                {isUpdating ? 'Updating…' : 'Refresh'}
              </button>
            </div>
          </DarkGlassCard>

          {/* Dedicated Dark Glass Emergency SOS Card with Glowing Pulse Action */}
          <div className="relative rounded-2xl p-6 bg-gradient-to-br from-rose-950/60 via-zinc-950 to-zinc-950 border border-rose-500/30 shadow-2xl shadow-rose-950/50 overflow-hidden">
            <div className="flex items-center gap-3.5 mb-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center shrink-0 shadow-lg shadow-rose-950/80 animate-pulse">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-base font-black text-white">Emergency SOS Protocol</p>
                <p className="text-xs text-rose-300/80">Immediate ambulance & hospital alert</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed mb-5">
              1-tap dispatches the nearest emergency response team with encrypted GPS coordinates to Jaipur control center.
            </p>

            <Link
              to={ROUTES.USER.EMERGENCY}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-black text-sm shadow-xl shadow-rose-950/80 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <PhoneCall className="h-4 w-4 animate-pulse" />
              <span>DISPATCH EMERGENCY HELP</span>
            </Link>
          </div>

          {/* Quick Actions Bento Grid */}
          <DarkGlassCard className="p-5">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-4">
              Rapid Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: PhoneCall,
                  label: 'Call 108 Emergency',
                  sub: 'Direct line',
                  action: () => {
                    window.location.href = 'tel:108';
                  },
                },
                {
                  icon: Share2,
                  label: 'Share Location',
                  sub: 'Send GPS coordinates',
                  action: () => {
                    void navigator.share?.({
                      title: 'My Location - resQ 2.O',
                      text: currentLocation.label || 'Jaipur Metropolitan',
                    });
                  },
                },
                {
                  icon: Users,
                  label: 'SOS Contacts',
                  sub: 'Manage family ties',
                  to: ROUTES.USER.PROFILE,
                },
                {
                  icon: FileText,
                  label: 'Health Records',
                  sub: 'Blood type & allergies',
                  to: ROUTES.USER.PROFILE,
                },
              ].map((qa, i) => {
                const Icon = qa.icon;
                const content = (
                  <div className="flex flex-col items-start p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.05] transition-all h-full">
                    <div className="bg-rose-500/10 text-rose-400 p-2 rounded-lg border border-rose-500/20 mb-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-bold text-white leading-tight">{qa.label}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{qa.sub}</p>
                  </div>
                );
                return qa.to ? (
                  <Link key={i} to={qa.to} className="cursor-pointer">
                    {content}
                  </Link>
                ) : (
                  <button key={i} type="button" onClick={qa.action} className="text-left w-full cursor-pointer">
                    {content}
                  </button>
                );
              })}
            </div>
          </DarkGlassCard>

          {/* Recent Requests Feed */}
          <DarkGlassCard className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-rose-400" />
                <span>Recent Requests</span>
              </h3>
              <Link to={ROUTES.USER.REQUESTS} className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition">
                View All
              </Link>
            </div>

            <div className="space-y-2.5">
              {emergenciesQ.isLoading ? (
                <div className="py-6 text-center text-zinc-400 text-xs">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1 text-rose-400" />
                  <span>Loading recent telemetry…</span>
                </div>
              ) : recentRequests.length === 0 ? (
                [
                  { icon: Ambulance, label: 'Ambulance Dispatch', date: 'Today, 14:15', status: 'RESOLVED' },
                  { icon: Calendar, label: 'Cardiology Consult', date: '04 Nov 2026', status: 'CONFIRMED' },
                  { icon: Beaker, label: 'Comprehensive Pathology', date: '28 Oct 2026', status: 'COMPLETED' },
                ].map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="bg-rose-500/10 text-rose-400 p-1.5 rounded-lg border border-rose-500/20 shrink-0">
                          <ItemIcon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">{item.label}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{item.date}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${requestStatusStyle(item.status)}`}>
                        {requestStatusLabel(item.status)}
                      </span>
                    </div>
                  );
                })
              ) : (
                recentRequests.map((req) => (
                  <Link
                    key={req.id}
                    to={ROUTES.USER.TRACKING(req.id)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="bg-rose-500/10 text-rose-400 p-1.5 rounded-lg border border-rose-500/20 shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{req.situationType}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">
                          {new Date(req.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${requestStatusStyle(req.status)}`}>
                      {requestStatusLabel(req.status)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </DarkGlassCard>

          {/* National & State Emergency Directory */}
          <DarkGlassCard className="p-5">
            <h3 className="text-xs font-bold text-white mb-3.5 flex items-center gap-2">
              <PhoneCall className="h-3.5 w-3.5 text-rose-400" />
              <span>National & Regional Emergency Helplines</span>
            </h3>
            <div className="space-y-1.5">
              {[
                { label: 'Central Ambulance Service', no: '108', color: '#f43f5e' },
                { label: 'National Unified Emergency', no: '112', color: '#fb7185' },
                { label: 'Police First Response', no: '100', color: '#60a5fa' },
                { label: 'Fire Service Brigade', no: '101', color: '#fb923c' },
                { label: 'Women Helpline Desk', no: '181', color: '#c084fc' },
              ].map((n) => (
                <a
                  key={n.no}
                  href={`tel:${n.no}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.05] transition-all cursor-pointer"
                >
                  <span className="text-xs text-zinc-300 font-medium">{n.label}</span>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-white/[0.04]" style={{ color: n.color }}>
                    {n.no}
                  </span>
                </a>
              ))}
            </div>
          </DarkGlassCard>

        </div>
      </div>
    </div>
  );
};
