import { useState, useMemo, useEffect } from 'react';
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
  CheckCircle2,
  Phone,
  Ambulance,
  FileText,
  Megaphone,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
} from 'lucide-react';
import { MapView } from '../../components/map/MapView';
import { hospitalApi } from '../../services/hospitalApi';
import { useHospitalProfile } from '../../hooks/useHospitalManagement';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes/routePaths';

/* ─── Priority helpers ──────────────────────────────────────────────── */
const priorityFor = (situationType: string) => {
  const s = situationType.toLowerCase();
  if (/accident|chest|stroke|unconscious|severe|critical/.test(s))
    return {
      label: 'Critical',
      bg: 'rgba(244,63,94,0.12)',
      border: 'rgba(244,63,94,0.25)',
      text: '#fb7185',
      dot: '#f43f5e',
      iconBg: 'rgba(244,63,94,0.15)',
    };
  if (/breathing|burn|high/.test(s))
    return {
      label: 'High',
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.22)',
      text: '#fbbf24',
      dot: '#f59e0b',
      iconBg: 'rgba(245,158,11,0.14)',
    };
  if (/maternity|medium/.test(s))
    return {
      label: 'Medium',
      bg: 'rgba(59,130,246,0.10)',
      border: 'rgba(59,130,246,0.22)',
      text: '#60a5fa',
      dot: '#3b82f6',
      iconBg: 'rgba(59,130,246,0.14)',
    };
  return {
    label: 'Low',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.10)',
    text: '#a1a1aa',
    dot: '#71717a',
    iconBg: 'rgba(255,255,255,0.08)',
  };
};

const timeAgo = (dateStr: string) => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff === 1) return '1 min ago';
  return `${diff} min ago`;
};

/* ─── Department bed data ────────────────────────────────────────────── */
const DEPT_CONFIG = [
  { key: 'ICU',            label: 'ICU',           total: 20 },
  { key: 'General Ward',   label: 'General Ward',  total: 60 },
  { key: 'Emergency',      label: 'Emergency',     total: 20 },
  { key: 'Private Rooms',  label: 'Private Rooms', total: 10 },
  { key: 'Isolation',      label: 'Isolation',     total: 10 },
];

/* ─── Department status ─────────────────────────────────────────────── */
const DEPT_STATUS = [
  { name: 'Emergency',        info: '8 patients',  status: 'Busy',      style: { bg: 'rgba(244,63,94,0.10)', color: '#fb7185' } },
  { name: 'ICU',              info: '12 / 20 beds', status: '75%',      style: { bg: 'rgba(245,158,11,0.10)', color: '#fbbf24' } },
  { name: 'General Medicine', info: '18 patients', status: 'Moderate',  style: { bg: 'rgba(245,158,11,0.10)', color: '#fbbf24' } },
  { name: 'Surgery',          info: '6 patients',  status: 'Available', style: { bg: 'rgba(16,185,129,0.10)', color: '#34d399' } },
  { name: 'Pediatrics',       info: '4 patients',  status: 'Available', style: { bg: 'rgba(16,185,129,0.10)', color: '#34d399' } },
];

/* ─── On-Duty Staff ─────────────────────────────────────────────────── */
const ON_DUTY_STAFF = [
  { name: 'Dr. Ankit Sharma', dept: 'Emergency',  status: 'Online',   initials: 'AS', color: 'rgba(244,63,94,0.15)'  },
  { name: 'Dr. Priya Singh',  dept: 'Cardiology', status: 'Online',   initials: 'PS', color: 'rgba(59,130,246,0.15)' },
  { name: 'Dr. Rohan Mehta',  dept: 'Orthopedics',status: 'Online',   initials: 'RM', color: 'rgba(16,185,129,0.15)' },
  { name: 'Dr. Neha Verma',   dept: 'Pediatrics', status: 'On Leave', initials: 'NV', color: 'rgba(245,158,11,0.15)' },
];

/* ─── Today's Appointments ──────────────────────────────────────────── */
const TODAY_APPTS = [
  { time: '09:00 AM', title: 'OPD – General Medicine',  patient: 'Rahul Sharma', status: 'Checked In' },
  { time: '10:30 AM', title: 'Cardiology Consultation', patient: 'Priya Mehta',  status: 'Upcoming'   },
  { time: '11:00 AM', title: 'Orthopedics Follow-up',   patient: 'Amit Kumar',   status: 'Upcoming'   },
  { time: '12:30 PM', title: 'Pediatrics Consultation', patient: 'Neha Gupta',   status: 'Upcoming'   },
];

/* ─── Shared glass card style ────────────────────────────────────────── */
const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.025)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.5)',
};

/* ═══════════════════════════════════════════════════════════════════════ */
export const HospitalDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'All' | 'Emergency' | 'Transfer' | 'Appointment'>('All');
  const [mapType, setMapType] = useState<'Map' | 'Satellite'>('Map');
  const [, setTick] = useState(0);

  // live clock tick
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

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

  /* Derived */
  const hospitalName   = profile.data?.name || user?.name || 'ResQ Demo Hospital';
  const city           = profile.data?.city  || 'Jaipur';
  const state          = profile.data?.state || 'Rajasthan';
  const isOnline       = profile.data?.emergencyAvailability === 'AVAILABLE' || profile.data?.emergencyAvailability === 'LIMITED';
  const hospitalLat    = profile.data?.latitude;
  const hospitalLng    = profile.data?.longitude;

  const allEmergencies    = useMemo(() => emergencies.data?.items ?? [], [emergencies.data?.items]);
  const activeEmergencies = useMemo(() => allEmergencies.filter((e) => !['RESOLVED', 'CANCELLED'].includes(e.status)), [allEmergencies]);
  const totalPatients     = patients.data?.pagination.total ?? 0;
  const resources         = profile.data?.resourceSummary ?? {};
  const totalBeds         = Object.values(resources).reduce((a, b) => a + b, 0) || 120;
  const occupiedBeds      = Math.round(totalBeds * 0.57);
  const availableBeds     = totalBeds - occupiedBeds;
  const occupancyPct      = Math.round((occupiedBeds / totalBeds) * 100);

  const filteredRequests = useMemo(() => {
    if (activeTab === 'All')       return allEmergencies.slice(0, 8);
    if (activeTab === 'Emergency') return activeEmergencies.slice(0, 5);
    return allEmergencies.slice(0, 3);
  }, [activeTab, allEmergencies, activeEmergencies]);

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

  const now     = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  /* ── Tab counts ── */
  const tabCounts = {
    All:         allEmergencies.length  || 12,
    Emergency:   activeEmergencies.length || 5,
    Transfer:    3,
    Appointment: 4,
  };

  return (
    <div
      className="flex flex-1 flex-col min-h-screen"
      style={{
        background: 'radial-gradient(ellipse 70% 40% at 15% 0%, rgba(244,63,94,0.06) 0%, transparent 55%), radial-gradient(ellipse 50% 35% at 90% 100%, rgba(245,158,11,0.04) 0%, transparent 55%), #08090a',
      }}
    >
      <div className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8">

        {/* ─── Hero Banner ─────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(120,10,30,0.25) 0%, rgba(24,24,27,0.65) 50%, rgba(9,9,11,0.85) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Subtle gradient mesh decoration */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 60% 80% at 80% 50%, rgba(244,63,94,0.06) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 10% 90%, rgba(245,158,11,0.04) 0%, transparent 60%)',
            }}
          />
          <div className="relative z-10 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-bold tracking-widest uppercase font-mono"
                  style={{ color: '#fb7185', letterSpacing: '0.15em' }}
                >
                  Hospital Panel
                </span>
                <span className="h-px flex-1 max-w-[40px]" style={{ background: 'rgba(244,63,94,0.3)' }} />
                <span
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                  style={isOnline
                    ? { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.20)' }
                    : { background: 'rgba(255,255,255,0.06)', color: '#71717a', border: '1px solid rgba(255,255,255,0.10)' }
                  }
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  {isOnline ? 'Online & Receiving' : 'Offline'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
                Welcome, {hospitalName}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed max-w-lg" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Manage emergency requests, patient appointments, bed availability, and hospital operations from your command hub.
              </p>
            </div>

            {/* Live clock */}
            <div
              className="shrink-0 rounded-2xl px-5 py-4 text-right"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                minWidth: '180px',
              }}
            >
              <p className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{dateStr}</p>
              <p className="text-2xl font-bold tracking-tight font-mono text-zinc-100">{timeStr.replace(/:\d{2} /, ' ')}</p>
              <p className="text-[10px] mt-1 font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <span className="text-amber-400">☁</span> 26°C · {city}, {state}
              </p>
            </div>
          </div>

          {/* Decorative watermark */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none select-none">
            <Building2 className="h-36 w-36 text-white" />
          </div>
        </div>

        {/* ─── 4 Stat Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          {/* Emergency Requests */}
          <div
            className="rounded-2xl p-5 transition-all duration-300 hover:border-white/[0.14] group cursor-default"
            style={{
              ...glassCard,
              background: 'rgba(244,63,94,0.05)',
              borderColor: 'rgba(244,63,94,0.15)',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(251,113,133,0.7)' }}>Emergency Requests</p>
                <p className="mt-2 text-3xl font-light text-zinc-100 tracking-tight">{activeEmergencies.length || 12}</p>
                <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  +4 new today
                  <span className="flex items-center gap-0.5 text-rose-400">
                    <TrendingDown className="h-2.5 w-2.5" /> 33%
                  </span>
                </p>
              </div>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.22)' }}
              >
                <AlertTriangle className="h-5 w-5 text-rose-400 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Total Patients */}
          <div
            className="rounded-2xl p-5 transition-all duration-300 hover:border-white/[0.14] cursor-default"
            style={glassCard}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(96,165,250,0.7)' }}>Total Patients</p>
                <p className="mt-2 text-3xl font-light text-zinc-100 tracking-tight">{totalPatients || 248}</p>
                <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  +18 today
                  <span className="flex items-center gap-0.5 text-emerald-400">
                    <TrendingUp className="h-2.5 w-2.5" /> 12%
                  </span>
                </p>
              </div>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)' }}
              >
                <Users className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Available Beds */}
          <div
            className="rounded-2xl p-5 transition-all duration-300 hover:border-white/[0.14] cursor-default"
            style={glassCard}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.7)' }}>Available Beds</p>
                <p className="mt-2 text-3xl font-light text-zinc-100 tracking-tight">
                  {availableBeds} <span className="text-lg font-light" style={{ color: 'rgba(255,255,255,0.30)' }}>/ {totalBeds}</span>
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{occupancyPct}% occupied</p>
              </div>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)' }}
              >
                <BedDouble className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* Today's Appointments */}
          <div
            className="rounded-2xl p-5 transition-all duration-300 hover:border-white/[0.14] cursor-default"
            style={glassCard}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(167,139,250,0.7)' }}>Today's Appointments</p>
                <p className="mt-2 text-3xl font-light text-zinc-100 tracking-tight">36</p>
                <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  +8 upcoming
                  <span className="flex items-center gap-0.5 text-emerald-400">
                    <TrendingUp className="h-2.5 w-2.5" /> 20%
                  </span>
                </p>
              </div>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)' }}
              >
                <Calendar className="h-5 w-5 text-violet-400" />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Main Content Grid ─────────────────────────────────────────── */}
        <div className="grid gap-5 xl:grid-cols-5">

          {/* ─── Left: Live Requests + Beds + Staff ──────────────────── */}
          <div className="xl:col-span-3 space-y-5">

            {/* Live Incoming Requests */}
            <div className="rounded-2xl overflow-hidden" style={glassCard}>
              <div
                className="flex items-center justify-between px-5 pt-4 pb-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.20)' }}
                  >
                    <Activity className="h-3.5 w-3.5 text-rose-400" />
                  </span>
                  <h2 className="text-sm font-semibold text-zinc-100">Live Incoming Requests</h2>
                  {activeEmergencies.length > 0 && (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white animate-pulse"
                      style={{ background: '#f43f5e' }}
                    >
                      {activeEmergencies.length}
                    </span>
                  )}
                </div>
                <button
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition"
                  onClick={() => navigate(ROUTES.HOSPITAL.REQUESTS)}
                >
                  View All →
                </button>
              </div>

              {/* Tabs */}
              <div className="px-5 pt-3 pb-2">
                <div
                  className="inline-flex gap-1 p-1 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {(['All', 'Emergency', 'Transfer', 'Appointment'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                      style={activeTab === tab
                        ? {
                            background: 'rgba(244,63,94,0.18)',
                            color: '#fb7185',
                            border: '1px solid rgba(244,63,94,0.28)',
                          }
                        : {
                            color: 'rgba(255,255,255,0.40)',
                            border: '1px solid transparent',
                          }
                      }
                    >
                      {tab}
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: activeTab === tab ? 'rgba(251,113,133,0.6)' : 'rgba(255,255,255,0.25)' }}
                      >
                        ({tabCounts[tab]})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Request rows */}
              <div className="px-5 pb-3 space-y-1">
                {emergencies.isLoading ? (
                  <div className="py-10 text-center">
                    <div
                      className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full"
                      style={{ border: '2px solid rgba(244,63,94,0.3)', borderTopColor: '#f43f5e' }}
                    />
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>Loading requests…</p>
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="py-10 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
                    <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>No active requests</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.20)' }}>All clear — no emergencies pending.</p>
                  </div>
                ) : (
                  filteredRequests.map((req) => {
                    const priority = priorityFor(req.situationType);
                    return (
                      <div
                        key={req.id}
                        className="flex items-center gap-3 py-3 rounded-xl px-2 transition-all duration-200 hover:bg-white/[0.04] cursor-pointer"
                        onClick={() => navigate(`${ROUTES.HOSPITAL.REQUESTS}/${req.id}`)}
                      >
                        {/* Priority icon */}
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: priority.iconBg, border: `1px solid ${priority.border}` }}
                        >
                          <AlertTriangle className="h-4 w-4" style={{ color: priority.text }} />
                        </div>

                        {/* Priority badge */}
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: priority.bg, color: priority.text, border: `1px solid ${priority.border}` }}
                        >
                          {priority.label}
                        </span>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{req.situationType}</p>
                          <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            <MapPin className="h-2.5 w-2.5" />
                            {req.location || `${city}, ${state}`}
                          </p>
                        </div>

                        {/* Time */}
                        <div className="shrink-0 flex items-center gap-1 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.30)' }}>
                          <Clock className="h-3 w-3" />
                          {timeAgo(req.reportedAt)}
                        </div>

                        {/* Accept button */}
                        <button
                          className="shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:scale-105 active:scale-95"
                          style={{
                            background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                            boxShadow: '0 4px 16px rgba(244,63,94,0.30)',
                          }}
                          onClick={(e) => { e.stopPropagation(); navigate(`${ROUTES.HOSPITAL.REQUESTS}/${req.id}`); }}
                        >
                          Accept
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bed Occupancy + Department Beds + On-Duty Staff */}
            <div className="grid gap-4 sm:grid-cols-3">

              {/* Bed Occupancy Donut */}
              <div className="rounded-2xl p-5" style={glassCard}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-zinc-200">Bed Occupancy</h3>
                  <button
                    className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition"
                    onClick={() => navigate(ROUTES.HOSPITAL.AVAILABILITY)}
                  >
                    Manage →
                  </button>
                </div>

                <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>TOTAL BEDS</p>
                <p className="text-2xl font-light text-zinc-100 mb-4">{totalBeds}</p>

                {/* Donut ring */}
                <div className="flex items-center justify-center my-2">
                  <div className="relative h-24 w-24">
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#f43f5e" strokeWidth="3"
                        strokeDasharray={`${occupancyPct} 100`}
                        strokeLinecap="round"
                      />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#10b981" strokeWidth="3"
                        strokeDasharray={`${100 - occupancyPct} 100`}
                        strokeDashoffset={`${-occupancyPct}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-lg font-bold text-zinc-100">{occupancyPct}%</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-3 text-[11px]">
                  {[
                    { label: 'Occupied',  count: occupiedBeds,  color: '#f43f5e' },
                    { label: 'Available', count: availableBeds, color: '#10b981' },
                    { label: 'Maintenance', count: 0,           color: 'rgba(255,255,255,0.20)' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                        {label}
                      </span>
                      <span className="font-semibold text-zinc-300">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Beds */}
              <div className="rounded-2xl p-5" style={glassCard}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-zinc-200">Dept. Beds</h3>
                  <button
                    className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition"
                    onClick={() => navigate('/hospital/beds')}
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-3">
                  {DEPT_CONFIG.map((dept) => {
                    const occupied = Math.round((resources[dept.key] ?? dept.total) * 0.6);
                    const pct      = Math.round((occupied / dept.total) * 100);
                    const barColor = pct >= 80 ? '#f43f5e' : pct >= 60 ? '#f59e0b' : '#3b82f6';
                    return (
                      <div key={dept.key}>
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span style={{ color: 'rgba(255,255,255,0.55)' }}>{dept.label}</span>
                          <span style={{ color: 'rgba(255,255,255,0.30)' }}>{occupied}/{dept.total}</span>
                          <span className="font-bold" style={{ color: barColor }}>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: barColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* On-Duty Staff */}
              <div className="rounded-2xl p-5" style={glassCard}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-zinc-200">On-Duty Staff</h3>
                  <button
                    className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition"
                    onClick={() => navigate('/hospital/staff')}
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-3">
                  {ON_DUTY_STAFF.map((staff) => (
                    <div key={staff.name} className="flex items-center gap-2.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-zinc-200"
                        style={{ background: staff.color, border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        {staff.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-200 truncate">{staff.name}</p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{staff.dept}</p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={staff.status === 'Online'
                          ? { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.20)' }
                          : { background: 'rgba(245,158,11,0.10)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.18)' }
                        }
                      >
                        {staff.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Right: Map + Hospital Status + Quick Actions + Appts + Dept ── */}
          <div className="xl:col-span-2 space-y-5">

            {/* Hospital Status */}
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">Hospital Status</h3>
                  <p
                    className="text-xs font-semibold mt-1.5 flex items-center gap-1.5"
                    style={{ color: isOnline ? '#34d399' : 'rgba(255,255,255,0.40)' }}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${isOnline ? 'animate-pulse' : ''}`}
                      style={{ background: isOnline ? '#10b981' : 'rgba(255,255,255,0.30)' }}
                    />
                    {isOnline ? 'Online & Receiving Requests' : 'Offline — Not Accepting'}
                  </p>
                </div>
                <div
                  className="relative inline-flex h-6 w-11 cursor-pointer rounded-full transition-all duration-300"
                  style={{ background: isOnline ? '#10b981' : 'rgba(255,255,255,0.15)' }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300"
                    style={{ transform: isOnline ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </div>
              </div>
            </div>

            {/* Nearby Ambulances Map */}
            <div className="rounded-2xl overflow-hidden" style={glassCard}>
              <div
                className="flex items-center justify-between px-4 pt-3 pb-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <h3 className="text-sm font-semibold text-zinc-200">Nearby Ambulances & Route</h3>
                <button
                  className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition"
                  onClick={() => navigate(ROUTES.HOSPITAL.EMERGENCY)}
                >
                  View All →
                </button>
              </div>
              {/* Map / Satellite toggle */}
              <div className="px-4 py-2">
                <div
                  className="inline-flex gap-1 p-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {(['Map', 'Satellite'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setMapType(t)}
                      className="rounded-md px-3 py-1 text-xs font-semibold transition"
                      style={mapType === t
                        ? { background: 'rgba(255,255,255,0.10)', color: '#e4e4e7' }
                        : { color: 'rgba(255,255,255,0.35)' }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[240px]">
                <MapView
                  markers={[...ambulanceMarkers, ...hospitalMarker]}
                  center={hospitalLat && hospitalLng ? { latitude: hospitalLat, longitude: hospitalLng } : undefined}
                  interactive
                  className="h-full w-full"
                />
              </div>
              <div
                className="flex items-center gap-4 px-4 py-2 text-[10px]"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
              >
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-rose-500" />Hospitals</span>
                <span className="flex items-center gap-1"><Ambulance className="h-3 w-3 text-amber-500" />Ambulances</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-blue-400" />Your Location</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: BedDouble,  label: 'Update\nBeds',        color: 'rgba(59,130,246,0.12)', tc: '#60a5fa', path: ROUTES.HOSPITAL.AVAILABILITY    },
                  { icon: Calendar,   label: 'Manage\nAppts',        color: 'rgba(139,92,246,0.12)', tc: '#a78bfa', path: ROUTES.HOSPITAL.APPOINTMENTS     },
                  { icon: Building2,  label: 'Add\nDept',            color: 'rgba(16,185,129,0.12)', tc: '#34d399', path: ROUTES.HOSPITAL.SERVICES          },
                  { icon: FileText,   label: 'Patient\nRecords',     color: 'rgba(244,63,94,0.12)',  tc: '#fb7185', path: ROUTES.HOSPITAL.PATIENTS           },
                  { icon: Ambulance,  label: 'Request\nAmbulance',   color: 'rgba(245,158,11,0.12)', tc: '#fbbf24', path: ROUTES.HOSPITAL.EMERGENCY          },
                  { icon: Megaphone,  label: 'Broadcast\nAlert',     color: 'rgba(20,184,166,0.12)', tc: '#2dd4bf', path: ROUTES.HOSPITAL.NOTIFICATIONS      },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className="flex flex-col items-center gap-2 rounded-xl p-3 transition-all duration-200 hover:bg-white/[0.05] hover:scale-105 active:scale-95"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: action.color, border: `1px solid ${action.tc}22` }}
                    >
                      <action.icon className="h-4.5 w-4.5" style={{ color: action.tc }} />
                    </div>
                    <span
                      className="text-[10px] font-semibold text-center leading-tight whitespace-pre-line"
                      style={{ color: 'rgba(255,255,255,0.50)' }}
                    >
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Today's Appointments */}
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-200">Today's Appointments</h3>
                <button
                  className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition"
                  onClick={() => navigate(ROUTES.HOSPITAL.APPOINTMENTS)}
                >
                  View All →
                </button>
              </div>
              <div className="space-y-3">
                {TODAY_APPTS.map((appt) => (
                  <div
                    key={appt.time}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]"
                  >
                    <div className="shrink-0 text-right min-w-[60px]">
                      <p className="text-[10px] font-bold font-mono text-zinc-300">{appt.time}</p>
                    </div>
                    <div
                      className="h-8 w-px shrink-0 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{appt.title}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{appt.patient}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={appt.status === 'Checked In'
                        ? { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.20)' }
                        : { background: 'rgba(59,130,246,0.10)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.18)' }
                      }
                    >
                      {appt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Status */}
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-200">Department Status</h3>
                <button className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition">View All →</button>
              </div>
              <div className="space-y-3">
                {DEPT_STATUS.map((dept) => (
                  <div key={dept.name} className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: dept.style.bg, border: `1px solid ${dept.style.color}22` }}
                    >
                      <Stethoscope className="h-4 w-4" style={{ color: dept.style.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{dept.name}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{dept.info}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: dept.style.bg, color: dept.style.color, border: `1px solid ${dept.style.color}33` }}
                    >
                      {dept.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Need Help card */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(244,63,94,0.06)',
                border: '1px solid rgba(244,63,94,0.18)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.25)' }}
                >
                  <Phone className="h-5 w-5 text-rose-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-zinc-200">Need Help?</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.40)' }}>Contact ResQ Support</p>
                </div>
                <a
                  href="tel:112"
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105 hover:shadow-lg shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                    boxShadow: '0 4px 16px rgba(244,63,94,0.25)',
                  }}
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
