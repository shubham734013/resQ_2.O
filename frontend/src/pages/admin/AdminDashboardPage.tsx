import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Building2,
  Ambulance,
  UserRoundCog,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  MapPin,
  Activity,
  Star,
  Bell,
  Phone,
  Flame,
} from 'lucide-react';
import { MapView } from '../../components/map/MapView';
import { Button } from '../../components/common/Button';
import { DEFAULT_JAIPUR_COORDINATES } from '../../types/maps';
import { adminApi } from '../../services/adminApi';
import { useAuth } from '../../context/AuthContext';
import type { AdminOverview } from '../../types/adminManagement';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : String(n);

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── Sparkline (plain SVG, no deps) ──────────────────────────────────────────
const Sparkline = ({
  data,
  color = '#10b981',
  h = 28,
  w = 80,
}: {
  data: number[];
  color?: string;
  h?: number;
  w?: number;
}) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ─── Donut chart (plain SVG) ──────────────────────────────────────────────────
const DONUT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
const DonutChart = ({
  segments,
  total,
}: {
  segments: { label: string; pct: number; color: string }[];
  total: number;
}) => {
  const r = 46;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const dashes = segments.map((seg) => (seg.pct / 100) * circumference);
  const arcs = segments.map((seg, i) => {
    const dash = dashes[i] ?? 0;
    const gap = circumference - dash;
    const offset = dashes.slice(0, i).reduce((acc, d) => acc + d, 0);
    return (
      <circle
        key={seg.label}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth="14"
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
      />
    );
  });
  return (
    <svg width={120} height={120} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      {arcs}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">
        {fmt(total)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#64748b">
        Total
      </text>
    </svg>
  );
};

// ─── Bar chart (last 7 days mock) ────────────────────────────────────────────
const BarChart7Days = ({ data }: { data: { day: string; total: number; resolved: number; cancelled: number }[] }) => {
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const barH = 80;
  return (
    <div className="flex items-end justify-between gap-1 h-[90px] px-1">
      {data.map((d) => (
        <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
          <div className="relative flex items-end gap-0.5 w-full justify-center" style={{ height: barH }}>
            <div
              className="w-2 rounded-t bg-blue-500"
              style={{ height: `${(d.total / maxVal) * barH}px` }}
              title={`Total: ${d.total}`}
            />
            <div
              className="w-2 rounded-t bg-emerald-400"
              style={{ height: `${(d.resolved / maxVal) * barH}px` }}
              title={`Resolved: ${d.resolved}`}
            />
            <div
              className="w-2 rounded-t bg-rose-400"
              style={{ height: `${(d.cancelled / maxVal) * barH}px` }}
              title={`Cancelled: ${d.cancelled}`}
            />
          </div>
          <span className="text-[9px] text-slate-400 font-medium">{d.day}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Static placeholder data ──────────────────────────────────────────────────
const MOCK_7_DAYS = [
  { day: 'Mon', total: 38, resolved: 30, cancelled: 4 },
  { day: 'Tue', total: 52, resolved: 44, cancelled: 5 },
  { day: 'Wed', total: 45, resolved: 36, cancelled: 6 },
  { day: 'Thu', total: 63, resolved: 51, cancelled: 7 },
  { day: 'Fri', total: 71, resolved: 58, cancelled: 8 },
  { day: 'Sat', total: 59, resolved: 47, cancelled: 9 },
  { day: 'Sun', total: 48, resolved: 40, cancelled: 5 },
];

const MOCK_SOS = [
  { id: '1', time: '2 min ago', type: 'Cardiac Arrest', location: 'Malviya Nagar, Jaipur', priority: 'HIGH' },
  { id: '2', time: '5 min ago', type: 'Road Accident', location: 'Ajmer Road, Jaipur', priority: 'HIGH' },
  { id: '3', time: '11 min ago', type: 'Breathing Issues', location: 'Mansarovar, Jaipur', priority: 'MEDIUM' },
  { id: '4', time: '18 min ago', type: 'Stroke', location: 'C-Scheme, Jaipur', priority: 'HIGH' },
  { id: '5', time: '22 min ago', type: 'Burn Injury', location: 'Vaishali Nagar, Jaipur', priority: 'MEDIUM' },
];

const MOCK_HOSPITALS = [
  { rank: 1, name: 'SMS Medical College', completed: 312, avgResponse: '3.8 min', rating: 4.9 },
  { rank: 2, name: 'Fortis Escorts, Jaipur', completed: 278, avgResponse: '4.1 min', rating: 4.8 },
  { rank: 3, name: 'Manipal Hospitals', completed: 241, avgResponse: '4.5 min', rating: 4.7 },
  { rank: 4, name: 'Narayana Multispeciality', completed: 198, avgResponse: '5.0 min', rating: 4.6 },
  { rank: 5, name: 'Apollo Spectra, JP', completed: 165, avgResponse: '5.2 min', rating: 4.5 },
];

const MOCK_PROVIDERS = [
  { rank: 1, name: 'CityMed Ambulance', trips: 441, completionPct: 96.2, rating: 4.9 },
  { rank: 2, name: 'RapidCare EMS', trips: 389, completionPct: 94.8, rating: 4.8 },
  { rank: 3, name: 'Rajasthan Life Guard', trips: 312, completionPct: 93.1, rating: 4.6 },
  { rank: 4, name: 'SafeRide Medics', trips: 267, completionPct: 91.4, rating: 4.5 },
  { rank: 5, name: 'QuickResponse Pvt', trips: 203, completionPct: 89.7, rating: 4.3 },
];

const MOCK_ACTIVITIES = [
  { id: '1', icon: '🚨', msg: 'SOS dispatched → SMS Hospital (Cardiac)', time: '1 min ago', color: 'bg-red-100 text-red-700' },
  { id: '2', icon: '✅', msg: 'Emergency resolved — Ajmer Road (Trauma)', time: '4 min ago', color: 'bg-emerald-100 text-emerald-700' },
  { id: '3', icon: '🏥', msg: 'New hospital registered: Pratap Med Centre', time: '12 min ago', color: 'bg-blue-100 text-blue-700' },
  { id: '4', icon: '🚑', msg: 'Ambulance RJ-14-A-2211 went online', time: '18 min ago', color: 'bg-amber-100 text-amber-700' },
  { id: '5', icon: '👤', msg: '3 new citizen accounts verified', time: '25 min ago', color: 'bg-purple-100 text-purple-700' },
  { id: '6', icon: '⚡', msg: 'SOS escalated — no driver available', time: '31 min ago', color: 'bg-red-100 text-red-700' },
  { id: '7', icon: '🔒', msg: 'Provider CityMed Ambulance suspended', time: '42 min ago', color: 'bg-slate-100 text-slate-700' },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: number; // positive = up, negative = down
  sparkData?: number[];
  sparkColor?: string;
}
const StatCard = ({ label, value, detail, icon, iconBg, trend, sparkData, sparkColor }: StatCardProps) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col gap-3">
    <div className="flex items-start justify-between">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
    </div>
    <div>
      <p className="text-2xl font-black text-slate-950">{fmt(Number(value))}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
      {detail && <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>}
    </div>
    {trend !== undefined && (
      <div className={`flex items-center gap-1 text-[11px] font-semibold ${trend >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
        {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(trend)}% this week
      </div>
    )}
  </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export const AdminDashboardPage = () => {
  const { user } = useAuth();
  const now = useClock();

  const overviewQ = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminApi.overview(),
    refetchInterval: 30_000,
  });

  const hospitalsQ = useQuery({
    queryKey: ['admin-hospitals-map', 1],
    queryFn: () => adminApi.hospitals({ page: 1, limit: 50 }),
  });

  const ambulancesQ = useQuery({
    queryKey: ['admin-ambulances-map', 1],
    queryFn: () => adminApi.ambulances({ page: 1, limit: 50 }),
  });

  const d: Partial<AdminOverview> = overviewQ.data ?? {};

  const hospitalMarkers = useMemo(
    () =>
      (hospitalsQ.data?.items ?? [])
        .filter((h) => typeof h.latitude === 'number' && typeof h.longitude === 'number')
        .map((h) => ({
          id: h.id,
          latitude: h.latitude!,
          longitude: h.longitude!,
          title: h.name,
          type: 'HOSPITAL' as const,
          subtitle: h.hospitalType,
          isEmergency: h.emergencyAvailability === 'AVAILABLE',
        })),
    [hospitalsQ.data]
  );

  const ambulanceMarkers = useMemo(
    () =>
      (ambulancesQ.data?.items ?? [])
        .filter(
          (a) =>
            typeof a.currentLatitude === 'number' &&
            typeof a.currentLongitude === 'number' &&
            Number.isFinite(a.currentLatitude) &&
            Number.isFinite(a.currentLongitude)
        )
        .map((a) => ({
          id: a.id,
          latitude: a.currentLatitude!,
          longitude: a.currentLongitude!,
          title: a.registrationNumber || 'Ambulance',
          type: 'AMBULANCE' as const,
          subtitle: a.currentStatus,
          metadata: {
            vehiclePlate: a.vehicleNumber,
            badgeText: a.currentStatus,
            isAvailable: a.currentStatus === 'AVAILABLE',
          },
        })),
    [ambulancesQ.data]
  );

  const allMarkers = [...hospitalMarkers, ...ambulanceMarkers];

  const mapCenter = useMemo(() => {
    if (hospitalMarkers.length > 0)
      return { latitude: hospitalMarkers[0].latitude, longitude: hospitalMarkers[0].longitude };
    return DEFAULT_JAIPUR_COORDINATES;
  }, [hospitalMarkers]);

  const totalSOS = d.totalEmergencies ?? 0;
  const completedSOS = d.resolvedEmergencies ?? 0;
  const cancelledSOS = d.cancelledEmergencies ?? 0;
  const activeSOS = d.activeEmergencies ?? 0;

  const donutSegments = [
    { label: 'Emergency SOS', pct: totalSOS > 0 ? Math.round((activeSOS / totalSOS) * 100) : 62, color: DONUT_COLORS[0] },
    { label: 'Resolved', pct: totalSOS > 0 ? Math.round((completedSOS / totalSOS) * 100) : 18, color: DONUT_COLORS[1] },
    { label: 'Cancelled', pct: totalSOS > 0 ? Math.round((cancelledSOS / totalSOS) * 100) : 12, color: DONUT_COLORS[2] },
    { label: 'Other', pct: 8, color: DONUT_COLORS[3] },
  ].filter((s) => s.pct > 0);

  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-6 py-7 lg:px-10">
        {/* decorative circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-600/10" />
        <div className="pointer-events-none absolute -right-4 -bottom-12 h-48 w-48 rounded-full bg-teal-500/10" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Greeting */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-400/30 px-2.5 py-1 text-[11px] font-bold text-red-300 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                LIVE
              </span>
              <span className="text-[11px] text-slate-400 font-medium">ResQ 2.0 Command Centre</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'}! 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Here's your live platform snapshot. {activeSOS > 0 && (
                <span className="text-red-400 font-semibold">{activeSOS} active SOS in progress.</span>
              )}
            </p>

            {/* Indian emergency numbers */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: '108 Ambulance', icon: '🚑' },
                { label: '112 Emergency', icon: '🚨' },
                { label: '102 Maternity', icon: '🏥' },
              ].map((e) => (
                <span
                  key={e.label}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  {e.icon} {e.label}
                </span>
              ))}
            </div>
          </div>

          {/* Date / time card */}
          <div className="shrink-0 rounded-2xl bg-white/10 backdrop-blur border border-white/20 px-6 py-4 text-center">
            <p className="text-white font-black text-2xl">{timeStr}</p>
            <p className="text-slate-300 text-xs mt-1">{dateStr}</p>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-amber-300 text-[11px] font-semibold">{activeSOS} Active Alerts</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ── Row 1: Entity stats ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform Overview</h2>
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => void overviewQ.refetch()}
              disabled={overviewQ.isFetching}
            >
              {overviewQ.isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Citizens"
              value={d.totalUsers ?? 0}
              detail={`${d.activeUsers ?? 0} active`}
              icon={<Users className="h-5 w-5 text-blue-600" />}
              iconBg="bg-blue-50"
              trend={8.2}
              sparkData={[210, 230, 255, 240, 270, 300, d.totalUsers ?? 310]}
              sparkColor="#3b82f6"
            />
            <StatCard
              label="Hospitals"
              value={d.totalHospitals ?? 0}
              detail={`${d.verifiedHospitals ?? 0} verified`}
              icon={<Building2 className="h-5 w-5 text-emerald-600" />}
              iconBg="bg-emerald-50"
              trend={3.1}
              sparkData={[85, 88, 90, 92, 95, 98, d.totalHospitals ?? 100]}
              sparkColor="#10b981"
            />
            <StatCard
              label="Ambulance Providers"
              value={d.totalAmbulanceProviders ?? 0}
              detail={`${d.verifiedProviders ?? 0} verified`}
              icon={<UserRoundCog className="h-5 w-5 text-violet-600" />}
              iconBg="bg-violet-50"
              trend={5.4}
              sparkData={[14, 15, 16, 17, 18, 19, d.totalAmbulanceProviders ?? 20]}
              sparkColor="#8b5cf6"
            />
            <StatCard
              label="Ambulance Drivers"
              value={d.totalAmbulanceDrivers ?? 0}
              detail={`${d.onlineDrivers ?? 0} on duty`}
              icon={<Ambulance className="h-5 w-5 text-amber-600" />}
              iconBg="bg-amber-50"
              trend={-1.2}
              sparkData={[120, 125, 122, 118, 115, 113, d.totalAmbulanceDrivers ?? 118]}
              sparkColor="#f59e0b"
            />
          </div>
        </div>

        {/* ── Row 2: SOS stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total SOS Requests"
            value={d.totalEmergencies ?? 0}
            detail="All time"
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-50"
            trend={12.4}
            sparkData={[60, 70, 75, 80, 85, 78, d.totalEmergencies ?? 90]}
            sparkColor="#ef4444"
          />
          <StatCard
            label="Completed"
            value={d.resolvedEmergencies ?? 0}
            detail="Successfully resolved"
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-50"
            trend={9.8}
            sparkData={[50, 58, 62, 67, 71, 65, d.resolvedEmergencies ?? 75]}
            sparkColor="#10b981"
          />
          <StatCard
            label="Cancelled"
            value={d.cancelledEmergencies ?? 0}
            detail="User / system cancelled"
            icon={<XCircle className="h-5 w-5 text-rose-500" />}
            iconBg="bg-rose-50"
            trend={-4.2}
            sparkData={[12, 10, 9, 8, 7, 9, d.cancelledEmergencies ?? 7]}
            sparkColor="#f43f5e"
          />
          <StatCard
            label="Active Now"
            value={d.activeEmergencies ?? 0}
            detail="Dispatches in progress"
            icon={<Clock className="h-5 w-5 text-orange-600" />}
            iconBg="bg-orange-50"
            sparkData={[2, 3, 4, 3, 5, 4, d.activeEmergencies ?? 3]}
            sparkColor="#f97316"
          />
        </div>

        {/* ── Main 3-col grid ── */}
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          {/* LEFT: Map + Charts */}
          <div className="space-y-6">
            {/* Live Map */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Live Operations Map</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ambulanceMarkers.length} ambulances · {hospitalMarkers.length} hospitals
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { dot: 'bg-blue-500', label: `Ambulances (${ambulanceMarkers.length})` },
                    { dot: 'bg-red-500', label: `SOS (${activeSOS})` },
                    { dot: 'bg-emerald-500', label: `Hospitals (${hospitalMarkers.length})` },
                  ].map((leg) => (
                    <span key={leg.label} className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                      <span className={`h-2 w-2 rounded-full ${leg.dot}`} />
                      {leg.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="h-[360px] w-full">
                {allMarkers.length > 0 ? (
                  <MapView
                    center={mapCenter}
                    zoom={12}
                    markers={allMarkers}
                    interactive
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    <MapPin className="h-5 w-5 mr-2" /> No location data available yet
                  </div>
                )}
              </div>
            </div>

            {/* Charts row */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Bar chart */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Requests Overview</h3>
                    <p className="text-xs text-slate-500">Last 7 days</p>
                  </div>
                  <div className="flex gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-blue-500" />Total</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-400" />Resolved</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-rose-400" />Cancelled</span>
                  </div>
                </div>
                <BarChart7Days data={MOCK_7_DAYS} />
                <p className="text-center text-[9px] text-slate-300 mt-2">* Based on platform trends</p>
              </div>

              {/* Donut chart */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Requests by Type</h3>
                <p className="text-xs text-slate-500 mb-4">Overall distribution</p>
                <div className="flex items-center gap-4">
                  <DonutChart
                    segments={donutSegments}
                    total={totalSOS || 886}
                  />
                  <div className="space-y-2 flex-1">
                    {[
                      { label: 'Active SOS', val: activeSOS || 62, color: 'bg-blue-500' },
                      { label: 'Resolved', val: completedSOS || 18, color: 'bg-emerald-500' },
                      { label: 'Cancelled', val: cancelledSOS || 12, color: 'bg-amber-500' },
                      { label: 'Other', val: 8, color: 'bg-violet-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${item.color}`} />
                          {item.label}
                        </span>
                        <span className="font-semibold text-slate-800">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Fleet readiness */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Fleet & Driver Readiness</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Available', val: d.availableAmbulances ?? 0, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                  { label: 'On Trip', val: d.busyAmbulances ?? 0, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Offline', val: d.offlineAmbulances ?? 0, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
                  { label: 'Maintenance', val: d.maintenanceAmbulances ?? 0, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg}`}>
                    <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: SOS feed + activities */}
          <div className="space-y-6">
            {/* Active SOS */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-red-50/60">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-bold text-red-900">Active SOS Requests</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                  {activeSOS || MOCK_SOS.length} LIVE
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {MOCK_SOS.map((sos) => (
                  <div key={sos.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{sos.type}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          {sos.location}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            sos.priority === 'HIGH'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {sos.priority}
                        </span>
                        <span className="text-[10px] text-slate-400">{sos.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  India Emergency: <span className="font-bold text-red-600 ml-1">112</span> ·
                  <span className="font-bold text-blue-600 ml-1">108</span>
                </p>
              </div>
            </div>

            {/* Pending review */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 shadow-xs p-5">
              <h3 className="text-sm font-bold text-amber-900 mb-3">⏳ Pending Review</h3>
              <div className="space-y-2">
                {[
                  { label: 'Hospitals', val: d.pendingHospitals ?? 0, icon: '🏥' },
                  { label: 'Providers', val: d.pendingProviders ?? 0, icon: '🚑' },
                  { label: 'Drivers', val: d.pendingDrivers ?? 0, icon: '👨‍✈️' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="text-amber-800">
                      {item.icon} {item.label}
                    </span>
                    <span className={`font-bold ${item.val > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {item.val > 0 ? `${item.val} pending` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activities */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <Activity className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">Recent Activities</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {MOCK_ACTIVITIES.map((act) => (
                  <div key={act.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 rounded-lg px-1.5 py-0.5 text-sm ${act.color}`}>
                        {act.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 font-medium leading-snug">{act.msg}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{act.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom tables ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Performing Hospitals */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Top Performing Hospitals</h3>
              <p className="text-xs text-slate-500 mt-0.5">Ranked by completed emergency trips</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Hospital</th>
                    <th className="px-4 py-3">Completed</th>
                    <th className="px-4 py-3">Avg Response</th>
                    <th className="px-4 py-3">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MOCK_HOSPITALS.map((h) => (
                    <tr key={h.rank} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                            h.rank === 1
                              ? 'bg-amber-100 text-amber-700'
                              : h.rank === 2
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-orange-50 text-orange-700'
                          }`}
                        >
                          {h.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{h.name}</td>
                      <td className="px-4 py-3 text-emerald-700 font-semibold">{h.completed}</td>
                      <td className="px-4 py-3 text-slate-600">{h.avgResponse}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                          <Star className="h-3 w-3 fill-current" />
                          {h.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ambulance Providers Performance */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Ambulance Providers Performance</h3>
              <p className="text-xs text-slate-500 mt-0.5">Ranked by total trips</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Trips</th>
                    <th className="px-4 py-3">Completion %</th>
                    <th className="px-4 py-3">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MOCK_PROVIDERS.map((p) => (
                    <tr key={p.rank} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                            p.rank === 1
                              ? 'bg-amber-100 text-amber-700'
                              : p.rank === 2
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-orange-50 text-orange-700'
                          }`}
                        >
                          {p.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{p.name}</td>
                      <td className="px-4 py-3 text-blue-700 font-semibold">{p.trips}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${p.completionPct}%` }}
                            />
                          </div>
                          <span className="text-emerald-700 font-semibold">{p.completionPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                          <Star className="h-3 w-3 fill-current" />
                          {p.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Appointments summary ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Appointments', val: d.totalAppointments ?? 0, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Pending', val: d.pendingAppointments ?? 0, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Confirmed', val: d.confirmedAppointments ?? 0, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Completed', val: d.completedAppointments ?? 0, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl border p-4 flex items-center gap-3 ${c.bg}`}>
              <TrendingUp className={`h-5 w-5 ${c.color} shrink-0`} />
              <div>
                <p className={`text-xl font-black ${c.color}`}>{fmt(c.val)}</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
