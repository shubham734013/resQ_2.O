import { useMemo, useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Ambulance,
  Users,
  Radio,
  CheckCircle2,
  MapPin,
  Plus,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Navigation,
  Car,
  UserCheck,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ambulanceProviderApi } from '../services/ambulanceProviderApi';
import type { AmbulanceStatus } from '../types/ambulanceOperations';
import { ROUTES } from '../routes/routePaths';

// ─── Reusable Mouse-Tracking Spotlight Bento Card ───────────────────────────
const SpotlightCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl group ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(400px circle at ${mousePos.x}% ${mousePos.y}%, rgba(244, 63, 94, 0.08), transparent 75%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

// ─── Input & Action Style Classes ───────────────────────────────────────────
const inputClass =
  'mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all';
const primaryBtnClass =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 px-5 text-sm font-bold text-white shadow-lg shadow-rose-950/60 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50';
const secondaryBtnClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-4 text-xs font-semibold text-zinc-200 transition-all cursor-pointer';

export interface AmbulanceProviderDashboardProps {
  initialSection?: 'overview' | 'ambulances' | 'drivers' | 'requests' | 'trips' | 'profile';
  embedded?: boolean;
}

export const AmbulanceProviderDashboardPage = ({
  initialSection,
  embedded,
}: AmbulanceProviderDashboardProps = {}) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const isProviderNamespace = location.pathname.startsWith('/provider');
  const isEmbedded = embedded ?? isProviderNamespace;

  const derivedSection =
    initialSection ||
    (location.pathname.includes('/ambulances')
      ? 'ambulances'
      : location.pathname.includes('/drivers')
      ? 'drivers'
      : location.pathname.includes('/requests')
      ? 'requests'
      : location.pathname.includes('/trips')
      ? 'trips'
      : location.pathname.includes('/profile')
      ? 'profile'
      : 'overview');

  const [activeSection, setActiveSection] = useState<
    'overview' | 'ambulances' | 'drivers' | 'requests' | 'trips' | 'profile' | null
  >(null);
  const section = initialSection ?? activeSection ?? derivedSection;

  const [showAmb, setShowAmb] = useState(false);
  const [showDriver, setShowDriver] = useState(false);

  // Queries
  const profile = useQuery({
    queryKey: ['ambulance-provider', 'profile'],
    queryFn: ambulanceProviderApi.getProfile,
  });

  const ambulances = useQuery({
    queryKey: ['ambulance-provider', 'ambulances'],
    queryFn: () => ambulanceProviderApi.getAmbulances({ limit: 100 }),
  });

  const drivers = useQuery({
    queryKey: ['ambulance-provider', 'drivers'],
    queryFn: () => ambulanceProviderApi.getDrivers({ limit: 100 }),
  });

  const requests = useQuery({
    queryKey: ['ambulance-provider', 'requests'],
    queryFn: () => ambulanceProviderApi.getRequests({ limit: 100 }),
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const trips = useQuery({
    queryKey: ['ambulance-provider', 'trips'],
    queryFn: () => ambulanceProviderApi.getTrips({ limit: 100 }),
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['ambulance-provider'] })]);

  // Mutations
  const addAmb = useMutation({
    mutationFn: ambulanceProviderApi.createAmbulance,
    onSuccess: async () => {
      setShowAmb(false);
      await refresh();
    },
  });

  const addDriver = useMutation({
    mutationFn: ambulanceProviderApi.createDriver,
    onSuccess: async () => {
      setShowDriver(false);
      await refresh();
    },
  });

  const assignDriver = useMutation({
    mutationFn: ({ ambulanceId, driverId }: { ambulanceId: string; driverId: string }) =>
      ambulanceProviderApi.assignDriver(ambulanceId, driverId),
    onSuccess: refresh,
  });

  const assignRequest = useMutation({
    mutationFn: ({ id, ambulanceId }: { id: string; ambulanceId: string }) =>
      ambulanceProviderApi.assignRequest(id, ambulanceId),
    onSuccess: refresh,
  });

  const updateAmbStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      ambulanceProviderApi.updateAmbulanceStatus(id, status),
    onSuccess: refresh,
  });

  // Derived Telemetry
  const totalAmbulances = ambulances.data?.pagination.total ?? (ambulances.data?.items ?? []).length;
  const activeAmb = (ambulances.data?.items ?? []).filter((x) => x.currentStatus === 'AVAILABLE').length;
  const busyAmb = (ambulances.data?.items ?? []).filter((x) => x.currentStatus === 'BUSY').length;
  const onlineDrivers = (drivers.data?.items ?? []).filter((x) => x.availabilityStatus === 'ONLINE').length;
  const totalRequests = requests.data?.pagination.total ?? (requests.data?.items ?? []).length;
  const activeTrips = (trips.data?.items ?? []).filter((x) => !['COMPLETED', 'CANCELLED'].includes(x.status));

  const nav = useMemo(
    () => ['overview', 'ambulances', 'drivers', 'requests', 'trips', 'profile'] as const,
    []
  );

  return (
    <main className={isEmbedded ? 'w-full text-zinc-100 font-sans' : 'min-h-screen bg-[#070709] text-zinc-100 font-sans p-6'}>
      {/* Standalone Header (only when not embedded in ProviderLayout) */}
      {!isEmbedded && (
        <header className="mb-6 rounded-2xl bg-white/[0.03] border border-white/10 p-5 backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-md">
              <Ambulance className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">resQ Fleet Command</p>
              <h1 className="text-xl font-bold text-white">{profile.data?.name ?? 'Ambulance Operations'}</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void logout().finally(() => navigate('/login', { replace: true }));
            }}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.08] transition"
          >
            Sign out
          </button>
        </header>
      )}

      {/* Standalone Segmented Navigation Bar */}
      {!isEmbedded && (
        <nav className="mb-8 flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
          {nav.map((x) => (
            <button
              key={x}
              onClick={() => setActiveSection(x)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                section === x
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
              }`}
            >
              {x[0].toUpperCase() + x.slice(1)}
            </button>
          ))}
        </nav>
      )}

      {/* ─── SECTION 1: OVERVIEW FLEET COMMAND DASHBOARD ───────────────────── */}
      {section === 'overview' && (
        <div className="space-y-8">
          {/* Top Telemetry Grid: 4 Spacious Dark Glass Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Total Fleet Ambulances */}
            <SpotlightCard>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                  Total Ambulances
                </span>
                <div className="bg-rose-500/10 text-rose-400 p-2.5 rounded-xl border border-rose-500/20">
                  <Ambulance className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-light text-zinc-100 tracking-tight font-mono">
                {totalAmbulances}
              </p>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Registered rapid fleet in service grid
              </p>
            </SpotlightCard>

            {/* Card 2: Available Units */}
            <SpotlightCard>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                  Available Units
                </span>
                <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-light text-emerald-400 tracking-tight font-mono">
                {activeAmb}
              </p>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Ready for instant GPS dispatch
              </p>
            </SpotlightCard>

            {/* Card 3: Busy Units */}
            <SpotlightCard>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                  In-Mission / Busy
                </span>
                <div className="bg-amber-500/10 text-amber-400 p-2.5 rounded-xl border border-amber-500/20">
                  <Radio className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-light text-amber-400 tracking-tight font-mono">
                {busyAmb}
              </p>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                En route to patient or ER trauma center
              </p>
            </SpotlightCard>

            {/* Card 4: Drivers Online */}
            <SpotlightCard>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                  Drivers Online
                </span>
                <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl border border-blue-500/20">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-light text-blue-400 tracking-tight font-mono">
                {onlineDrivers}
              </p>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Paramedics & operators checked in
              </p>
            </SpotlightCard>
          </div>

          {/* Quick Operations Strip */}
          <div className="rounded-2xl bg-white/[0.025] border border-white/10 p-5 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <Activity className="h-4.5 w-4.5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Automated Algorithmic Dispatch Engine</p>
                <p className="text-[11px] text-zinc-400">Jaipur central telemetry relay synced · SLA 99.8%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={ROUTES.PROVIDER.DISPATCH}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 shadow-md shadow-rose-950/50 transition-all cursor-pointer"
              >
                <span>Live Dispatch Board</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Operations Queue & Active Trips Workspace: Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left: Request Queue Card */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl hover:border-white/20 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    <h2 className="text-base font-bold text-white tracking-tight">Operations Request Queue</h2>
                  </div>
                  {/* Numerical Typography: JetBrains Mono monospace font */}
                  <p className="text-3xl font-light text-zinc-100 tracking-tight font-mono mt-2">
                    {requests.data?.pagination.total ?? 0}
                  </p>
                  {/* Incoming request counters with muted crimson accent highlights */}
                  <p className="text-sm text-zinc-400 leading-relaxed mt-1">
                    <span className="text-rose-400 font-semibold">{totalRequests} Operational emergency requests</span>{' '}
                    visible to this provider.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => requests.refetch()}
                  className="p-2 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                  title="Refresh Queue"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {/* Request List */}
              <div className="space-y-3.5">
                {(requests.data?.items ?? []).slice(0, 4).map((r) => {
                  const isAssigned = Boolean(r.ambulanceId);
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl p-4 bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-white bg-white/[0.05] px-2 py-0.5 rounded border border-white/10">
                              {r.requestCode}
                            </span>
                            <span className="text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                              {r.situationType}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-2">
                            <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate max-w-[240px]">{r.location ?? 'Jaipur jurisdiction'}</span>
                          </p>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isAssigned ? 'pill-active' : 'pill-critical'
                          }`}
                        >
                          {r.driverId ? 'Driver Assigned' : r.ambulanceId ? 'Unit Dispatched' : 'Pending Dispatch'}
                        </span>
                      </div>

                      {/* Assignment Control if not yet assigned */}
                      {!r.ambulanceId && (
                        <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2">
                          <select
                            className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-rose-500/40"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                assignRequest.mutate({ id: r.id, ambulanceId: e.target.value });
                              }
                            }}
                          >
                            <option value="">Select available ambulance...</option>
                            {(ambulances.data?.items ?? [])
                              .filter((a) => a.currentStatus === 'AVAILABLE')
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.registrationNumber} ({a.ambulanceType})
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}

                {(requests.data?.items ?? []).length === 0 && (
                  <div className="py-12 text-center text-zinc-400 bg-white/[0.015] border border-white/5 rounded-xl p-6">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400/80 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-zinc-200">Zero Unassigned Emergency Requests</p>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      All incoming citizen and hospital triage calls are serviced. Standby units ready.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Active Trips Card */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl hover:border-white/20 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Navigation className="h-4 w-4 text-emerald-400" />
                    <h2 className="text-base font-bold text-white tracking-tight">Active Fleet Trips</h2>
                  </div>
                  {/* Numerical Typography: JetBrains Mono monospace font */}
                  <p className="text-3xl font-light text-zinc-100 tracking-tight font-mono mt-2">
                    {activeTrips.length}
                  </p>
                  <p className="text-sm text-zinc-400 leading-relaxed mt-1">
                    Trips involving this provider's fleet currently in motion.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => trips.refetch()}
                  className="p-2 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                  title="Refresh Trips"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {/* Trips List / Uncluttered Tracker */}
              <div className="space-y-3.5">
                {activeTrips.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl p-4 bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-200">
                          TRIP #{t.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          Req: {t.emergencyRequestId.slice(-6)}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{t.status.replace(/_/g, ' ')}</span>
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Vehicle ID: <span className="font-mono text-zinc-200">{t.ambulanceId.slice(-6)}</span> ·{' '}
                      Destination Hospital: <span className="text-zinc-200">{t.destinationHospitalId.slice(-6)}</span>
                    </p>
                  </div>
                ))}

                {activeTrips.length === 0 && (
                  <div className="py-12 text-center text-zinc-400 bg-white/[0.015] border border-white/5 rounded-xl p-6">
                    <Navigation className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-zinc-200">Fleet Units Stationed</p>
                    {/* Clean line-height body text */}
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-sm mx-auto">
                      All registered ambulances are currently positioned at base depots or on standby for new emergency dispatches.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── SECTION 2: AMBULANCES MANAGEMENT ─────────────────────────────── */}
      {section === 'ambulances' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Ambulance Fleet Directory</h2>
              <p className="text-xs text-zinc-400 mt-1">Manage vehicles, capabilities, and active deployment status</p>
            </div>
            <button
              type="button"
              className={primaryBtnClass}
              onClick={() => setShowAmb((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              <span>{showAmb ? 'Close Registration' : 'Register New Ambulance'}</span>
            </button>
          </div>

          {/* Add Ambulance Form */}
          {showAmb && (
            <form
              className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 shadow-2xl space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                addAmb.mutate({
                  registrationNumber: String(f.get('registrationNumber')),
                  vehicleNumber: String(f.get('vehicleNumber')),
                  ambulanceType: String(f.get('ambulanceType')),
                  capabilities: String(f.get('capabilities') ?? '')
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean),
                  serviceArea: String(f.get('serviceArea') || '') || undefined,
                });
              }}
            >
              <h3 className="text-sm font-bold text-white">Register Rapid Response Unit</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-zinc-300">
                  Registration Number
                  <input name="registrationNumber" required placeholder="RJ14 AB 1234" className={inputClass} />
                </label>
                <label className="text-xs text-zinc-300">
                  Vehicle Identifier
                  <input name="vehicleNumber" required placeholder="AMB-04" className={inputClass} />
                </label>
                <label className="text-xs text-zinc-300">
                  Ambulance Type
                  <input name="ambulanceType" required placeholder="Advanced Life Support (ALS)" className={inputClass} />
                </label>
                <label className="text-xs text-zinc-300">
                  Service Area
                  <input name="serviceArea" placeholder="Jaipur Central / Mansarovar" className={inputClass} />
                </label>
                <label className="text-xs text-zinc-300 sm:col-span-2">
                  Capabilities (comma separated)
                  <input name="capabilities" placeholder="Ventilator, Defibrillator, Oxygen, ICU Monitor" className={inputClass} />
                </label>
              </div>
              <button type="submit" className={`${primaryBtnClass} mt-2`} disabled={addAmb.isPending}>
                {addAmb.isPending ? 'Registering…' : 'Confirm Registration'}
              </button>
            </form>
          )}

          {/* Ambulance Grid */}
          <div className="grid gap-5 lg:grid-cols-2">
            {(ambulances.data?.items ?? []).map((a) => (
              <div
                key={a.id}
                className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 hover:border-white/20 transition-all shadow-xl space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                      <Car className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base leading-snug">{a.registrationNumber}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {a.vehicleNumber} · {a.ambulanceType}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      a.currentStatus === 'AVAILABLE'
                        ? 'pill-active'
                        : a.currentStatus === 'BUSY'
                        ? 'pill-warning'
                        : 'pill-neutral'
                    }`}
                  >
                    {a.currentStatus}
                  </span>
                </div>

                <div className="text-xs text-zinc-300 flex items-center gap-2">
                  <span className="text-zinc-500">Assigned Driver:</span>
                  <span className="font-semibold text-white">
                    {a.assignedDriver?.fullName ?? 'Unassigned Operator'}
                  </span>
                </div>

                {a.capabilities && a.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {a.capabilities.map((c, i) => (
                      <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 border border-white/10">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                  {(['AVAILABLE', 'OFFLINE', 'MAINTENANCE'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={updateAmbStatus.isPending || a.currentStatus === s}
                      onClick={() => updateAmbStatus.mutate({ id: a.id, status: s as AmbulanceStatus })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        a.currentStatus === s
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}

                  {/* Assign Driver Dropdown */}
                  {(drivers.data?.items ?? []).length > 0 && (
                    <select
                      className="ml-auto rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-rose-500/40"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          assignDriver.mutate({ ambulanceId: a.id, driverId: e.target.value });
                        }
                      }}
                    >
                      <option value="">Assign Driver...</option>
                      {(drivers.data?.items ?? [])
                        .filter((d) => !d.assignedAmbulanceId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.fullName}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SECTION 3: DRIVERS ROSTER ───────────────────────────────────── */}
      {section === 'drivers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Paramedics & Driver Roster</h2>
              <p className="text-xs text-zinc-400 mt-1">Verified crew licenses and fleet assignments</p>
            </div>
            <button
              type="button"
              className={primaryBtnClass}
              onClick={() => setShowDriver((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              <span>{showDriver ? 'Close Form' : 'Register New Driver'}</span>
            </button>
          </div>

          {/* Add Driver Form */}
          {showDriver && (
            <form
              className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 shadow-2xl space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                addDriver.mutate({
                  fullName: String(f.get('fullName')),
                  email: String(f.get('email')),
                  phone: String(f.get('phone')),
                  password: String(f.get('password')),
                  licenseNumber: String(f.get('licenseNumber')),
                });
              }}
            >
              <h3 className="text-sm font-bold text-white">Enroll Certified Paramedic / Driver</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-zinc-300">
                  Full Name
                  <input name="fullName" required placeholder="Rajesh Kumar" className={inputClass} />
                </label>
                <label className="text-xs text-zinc-300">
                  Email Address
                  <input type="email" name="email" required placeholder="rajesh@fleet.internal" className={inputClass} />
                </label>
                <label className="text-xs text-zinc-300">
                  Phone Number
                  <input name="phone" required placeholder="+91 98765 43210" className={inputClass} />
                </label>
                <label className="text-xs text-zinc-300">
                  Commercial Driving License (DL)
                  <input name="licenseNumber" required placeholder="RJ14-2022-0091823" className={inputClass} />
                </label>
                <label className="text-xs text-zinc-300 sm:col-span-2">
                  Temporary Driver Password
                  <input type="password" name="password" minLength={12} required placeholder="Minimum 12 characters" className={inputClass} />
                </label>
              </div>
              <button type="submit" className={`${primaryBtnClass} mt-2`} disabled={addDriver.isPending}>
                {addDriver.isPending ? 'Enrolling…' : 'Enroll Paramedic'}
              </button>
            </form>
          )}

          {/* Drivers Grid */}
          <div className="grid gap-5 lg:grid-cols-2">
            {(drivers.data?.items ?? []).map((d) => (
              <div
                key={d.id}
                className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 hover:border-white/20 transition-all shadow-xl space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base leading-snug">{d.fullName}</p>
                      <p className="text-xs text-zinc-400 mt-0.5 font-mono">{d.email} · {d.phone}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      d.availabilityStatus === 'ONLINE' ? 'pill-active' : 'pill-neutral'
                    }`}
                  >
                    {d.availabilityStatus}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-mono">DL: {d.licenseNumber}</span>
                  <span className="text-rose-300 font-semibold">
                    {d.assignedAmbulanceId ? 'Vehicle Assigned' : 'Roster Standby'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SECTION 4: EMERGENCY REQUESTS ────────────────────────────────── */}
      {section === 'requests' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Emergency Incident Dispatch Queue</h2>
              <p className="text-xs text-zinc-400 mt-1">Real-time emergency requests incoming from citizens and hospitals</p>
            </div>
            <button
              type="button"
              onClick={() => requests.refetch()}
              className={secondaryBtnClass}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Queue</span>
            </button>
          </div>

          <div className="space-y-4">
            {(requests.data?.items ?? []).map((r) => (
              <div
                key={r.id}
                className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 hover:border-white/20 transition-all shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-white bg-white/[0.05] px-2.5 py-1 rounded-md border border-white/10">
                      {r.requestCode}
                    </span>
                    <span className="text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
                      {r.situationType}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 flex items-center gap-2 mt-2.5">
                    <MapPin className="h-4 w-4 text-rose-500" />
                    <span>{r.location ?? 'Jaipur metropolitan coordinate grid'}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {!r.ambulanceId ? (
                    <select
                      className="rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-200 outline-none focus:border-rose-500/40"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          assignRequest.mutate({ id: r.id, ambulanceId: e.target.value });
                        }
                      }}
                    >
                      <option value="">Select Rapid Ambulance Unit...</option>
                      {(ambulances.data?.items ?? [])
                        .filter((a) => a.currentStatus === 'AVAILABLE')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.registrationNumber} ({a.ambulanceType})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                      Dispatched: Unit Assigned
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SECTION 5: TRIPS TELEMETRY ───────────────────────────────────── */}
      {section === 'trips' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Fleet Trips & Transit Telemetry</h2>
              <p className="text-xs text-zinc-400 mt-1">Live patient transit, arrival milestones, and dispatch archives</p>
            </div>
            <button
              type="button"
              onClick={() => trips.refetch()}
              className={secondaryBtnClass}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="space-y-4">
            {(trips.data?.items ?? []).map((t) => (
              <div
                key={t.id}
                className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 hover:border-white/20 transition-all shadow-xl flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <Navigation className="h-4 w-4 text-emerald-400" />
                    <p className="font-mono text-xs font-bold text-white">TRIP #{t.id.slice(-8).toUpperCase()}</p>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Emergency Request: <span className="font-mono text-zinc-200">{t.emergencyRequestId}</span> ·{' '}
                    Ambulance Vehicle: <span className="font-mono text-zinc-200">{t.ambulanceId}</span>
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/[0.04] border border-white/10 text-zinc-300">
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SECTION 6: PROVIDER ENTERPRISE PROFILE ───────────────────────── */}
      {section === 'profile' && profile.data && (
        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 shadow-2xl space-y-6 max-w-4xl">
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{profile.data.name}</h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-3 w-3 text-rose-400" />
                  <span>VERIFIED ABDM Partner</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-mono">Reg: {profile.data.registrationNumber}</p>
            </div>
            <span className="pill-active px-3 py-1 rounded-full text-xs font-bold">
              {profile.data.accountStatus}
            </span>
          </div>

          <dl className="grid gap-6 sm:grid-cols-2">
            {[
              ['Organization Name', profile.data.name],
              ['Official Registration Number', profile.data.registrationNumber],
              ['24/7 Operations Phone', profile.data.phone],
              ['Authorized Service Tier', profile.data.serviceType],
              ['ABDM Verification Status', profile.data.verificationStatus],
              ['Platform Account Status', profile.data.accountStatus],
              ['Jurisdiction Coverage', 'Jaipur Central, Mansarovar, Malviya Nagar, Vaishali'],
              ['Emergency Telemetry Node', 'resQ-Grid-Router-RJ14-Alpha'],
            ].map(([k, v]) => (
              <div key={k} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <dt className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{k}</dt>
                <dd className="mt-1 font-bold text-sm text-zinc-100">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Loading state indicator */}
      {(profile.isLoading || ambulances.isLoading || drivers.isLoading || requests.isLoading || trips.isLoading) && (
        <div role="status" aria-live="polite" className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-xs text-zinc-400">
          <RefreshCw className="h-4 w-4 animate-spin text-rose-400" />
          <span>Synchronizing live fleet telemetry and incident queue…</span>
        </div>
      )}

      {/* Error state alerts */}
      {(profile.isError || ambulances.isError || drivers.isError || requests.isError || trips.isError) && (
        <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>Some live operational data could not be fetched. Telemetry values may be stale.</span>
          </div>
          <button
            type="button"
            className="rounded-xl border border-rose-500/30 bg-rose-500/20 px-3.5 py-1.5 font-bold text-rose-200 hover:bg-rose-500/30 transition cursor-pointer"
            onClick={() => {
              void Promise.all([
                profile.refetch(),
                ambulances.refetch(),
                drivers.refetch(),
                requests.refetch(),
                trips.refetch(),
              ]);
            }}
          >
            Retry Telemetry Sync
          </button>
        </div>
      )}
    </main>
  );
};
