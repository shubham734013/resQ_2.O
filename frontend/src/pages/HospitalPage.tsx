/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Ambulance,
  Building2,
  CircleAlert,
  MapPinned,
  RefreshCw,
  Save,
  Search,
  UserRound,
  Loader2,
  Layers,
  Activity,
  BedDouble,
} from 'lucide-react';
import type { HospitalProfileUpdate } from '../services/hospitalApi';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  useHospitalAmbulances,
  useHospitalAvailability,
  useHospitalAvailabilityMutation,
  useHospitalCapabilities,
  useHospitalCapabilitiesMutation,
  useHospitalEmergencyStatusMutation,
  useHospitalEmergencies,
  useHospitalEmergency,
  useHospitalEmergencySummary,
  useHospitalPatients,
  useHospitalPatient,
  useHospitalProfile,
  useHospitalProfileMutation,
  useHospitalResources,
  useHospitalResourcesMutation,
  useHospitalServices,
  useHospitalServicesMutation,
  useHospitalAmbulance,
} from '../hooks/useHospitalManagement';
import type { HospitalEmergencyStatus, HospitalEmergencySummary } from '../types/hospitalManagement';
import { MapView, darkMapStyle } from '../components/map/MapView';
import { LiveAmbulanceTracking } from '../components/LiveAmbulanceTracking';
import { IncomingAmbulanceAlertPanel } from '../components/hospital/IncomingAmbulanceAlertPanel';
import { HospitalCoordinationInbox } from '../components/hospital/HospitalCoordinationInbox';

const wrap = 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8';
const box = 'rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-xl';

const ErrorState = ({ retry }: { retry: () => void }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
    <span>Unable to load hospital operations data.</span>
    <button
      type="button"
      onClick={retry}
      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium transition flex items-center gap-1.5 cursor-pointer"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      <span>Retry</span>
    </button>
  </div>
);

const Loading = () => (
  <div className="p-12 text-center text-xs font-mono text-zinc-500 flex items-center justify-center gap-2">
    <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
    <span>Loading hospital telemetry…</span>
  </div>
);

const Freshness = ({ value }: { value?: string }) => (
  <p className="text-[11px] font-mono text-zinc-500">
    {value ? `Updated ${new Date(value).toLocaleTimeString()}` : 'Live Telemetry'}
  </p>
);

const PageShell = ({ children }: { children: ReactNode }) => (
  <div className="relative min-h-screen bg-[#070709] text-zinc-100 font-sans selection:bg-rose-500/20 selection:text-rose-200 overflow-hidden">
    {/* Ambient radial background glows */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      <div
        className="absolute -top-32 left-1/3 h-[500px] w-[500px] rounded-full opacity-[0.07] blur-[150px]"
        style={{ background: 'radial-gradient(circle, #f43f5e 0%, #f59e0b 50%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-32 right-1/4 h-[500px] w-[500px] rounded-full opacity-[0.05] blur-[160px]"
        style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
      />
    </div>
    <div className={`relative z-10 ${wrap}`}>{children}</div>
  </div>
);

const availabilityLabel: Record<string, string> = {
  AVAILABLE: 'Available',
  LIMITED: 'Limited Capacity',
  UNAVAILABLE: 'Unavailable',
  UNKNOWN: 'Standby',
};

const statusVariant = (value: string): 'verified' | 'waitTime' | 'neutral' =>
  value === 'AVAILABLE' || value === 'VERIFIED' || value === 'RESOLVED' || value === 'CONFIRMED'
    ? 'verified'
    : value === 'UNAVAILABLE' || value === 'CANCELLED' || value === 'REJECTED'
    ? 'neutral'
    : 'waitTime';

export const HospitalPage = ({
  tab,
}: {
  tab?: 'overview' | 'requests' | 'patients' | 'ambulances' | 'services' | 'profile' | 'emergency' | 'availability';
} = {}) => {
  const location = useLocation();
  const path = location.pathname;

  if (tab === 'emergency' || path === '/hospital/emergency') {
    return (
      <PageShell>
        <div className="space-y-6">
          <HospitalCoordinationInbox />
        </div>
      </PageShell>
    );
  }
  if (tab === 'requests' || path === '/hospital/requests' || path === '/hospital/emergencies') return <HospitalEmergenciesPage />;
  if (tab === 'patients' || path === '/hospital/patients') return <HospitalPatientsPage />;
  if (tab === 'ambulances' || path === '/hospital/ambulances') return <HospitalAmbulancesPage />;
  if (tab === 'services' || tab === 'availability' || path === '/hospital/services' || path === '/hospital/resources' || path === '/hospital/availability') return <HospitalResourcesPage />;
  if (tab === 'profile' || path === '/hospital/profile') return <HospitalProfilePage />;
  return <HospitalOverviewPage />;
};

/* ─── OVERVIEW PAGE ──────────────────────────────────────────────────────── */
const HospitalOverviewPage = () => {
  const profile = useHospitalProfile();
  const emergencies = useHospitalEmergencies({ page: 1, limit: 10 });
  const patients = useHospitalPatients({ page: 1, limit: 5 });
  const ambulances = useHospitalAmbulances({ page: 1, limit: 5 });
  const statusMutation = useHospitalEmergencyStatusMutation();

  if (profile.isLoading || emergencies.isLoading) return <PageShell><Loading /></PageShell>;
  if (profile.isError) return <PageShell><ErrorState retry={() => void profile.refetch()} /></PageShell>;
  const p = profile.data;
  if (!p) return <PageShell><ErrorState retry={() => void profile.refetch()} /></PageShell>;

  const metrics = [
    { label: 'Emergency Availability', value: availabilityLabel[p.emergencyAvailability] ?? p.emergencyAvailability, icon: CircleAlert, color: 'text-emerald-400' },
    { label: 'Active Queue Requests', value: emergencies.data?.pagination.total ?? 0, icon: Activity, color: 'text-rose-400' },
    { label: 'Coordinated Inpatients', value: patients.data?.pagination.total ?? 0, icon: UserRound, color: 'text-blue-400' },
    { label: 'Linked Ambulances', value: ambulances.data?.pagination.total ?? 0, icon: Ambulance, color: 'text-purple-400' },
  ];

  return (
    <PageShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono font-bold text-rose-300 uppercase tracking-wider mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Operational Command Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight">{p.name}</h1>
          <p className="mt-1 text-xs text-zinc-400 font-light">
            {p.address ?? 'Jaipur metropolitan jurisdiction'}{p.city ? `, ${p.city}` : ''}
          </p>
        </div>
        <StatusBadge variant={statusVariant(p.verificationStatus)} label={p.verificationStatus} />
      </div>

      <div className="mt-6"><HospitalCoordinationInbox /></div>

      <div className="mt-6">
        <IncomingAmbulanceAlertPanel
          emergencies={emergencies.data?.items ?? []}
          onUpdateStatus={(id, status) => statusMutation.mutate({ id, status })}
          isUpdating={statusMutation.isPending}
          updatingId={statusMutation.variables?.id}
          onRefresh={() => void emergencies.refetch()}
        />
      </div>

      {/* 4 Spacious Bento Metric Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className={`${box} p-5 space-y-2`}>
            <div className="flex justify-between items-center text-xs font-mono text-zinc-400">
              <span>{m.label}</span>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <p className="text-3xl font-light font-mono text-zinc-100 tracking-tight">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className={box}>
          <header className="border-b border-white/10 p-5 flex items-center justify-between">
            <h3 className="font-medium text-sm text-zinc-100">Live Intake Feed</h3>
            <Freshness value={p.updatedAt} />
          </header>
          {emergencies.isError ? (
            <div className="p-4"><ErrorState retry={() => void emergencies.refetch()} /></div>
          ) : emergencies.data?.items.length ? (
            <div className="divide-y divide-white/[0.06]">
              {emergencies.data.items.map((e) => (
                <div key={e.id} className="p-4 hover:bg-white/[0.02] transition">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-zinc-200">
                        <span className="font-mono text-zinc-400 mr-2">{e.requestCode}</span>
                        {e.situationType}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400 font-light">{e.location ?? 'Pickup coordinates transmitted'}</p>
                    </div>
                    <StatusBadge variant={statusVariant(e.status)} label={e.status} />
                  </div>
                  <p className="mt-2 text-[11px] font-mono text-zinc-500">
                    Received {new Date(e.reportedAt).toLocaleTimeString()}{e.etaMinutes !== undefined ? ` · ETA ${e.etaMinutes} min` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-xs font-mono text-zinc-500">No incoming emergency requests in intake.</p>
          )}
        </section>

        <section className={box}>
          <header className="border-b border-white/10 p-5 flex items-center justify-between">
            <h3 className="font-medium text-sm text-zinc-100">Active Department Resources</h3>
            <Freshness value={p.updatedAt} />
          </header>
          {Object.keys(p.resourceSummary).length ? (
            <div className="divide-y divide-white/[0.06]">
              {Object.entries(p.resourceSummary).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition text-xs">
                  <span className="font-medium text-zinc-300 capitalize">{key.replace(/[_-]/g, ' ')}</span>
                  <span className="font-mono font-bold text-zinc-100 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-lg">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-xs font-mono text-zinc-500">No resource telemetry configured.</p>
          )}
        </section>
      </div>
    </PageShell>
  );
};

const formatElapsed = (value: string): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ${minutes % 60} min ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

/* ─── SECTION 2.A: EMERGENCY REQUESTS & COORDINATION KANBAN ──────────────── */
const HospitalEmergenciesPage = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [situationType, setSituationType] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const q = useHospitalEmergencies({
    page,
    limit: 10,
    status: status || undefined,
    situationType: situationType.trim() || undefined,
    search: search.trim() || undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  });

  const summary = useHospitalEmergencySummary();
  const mutation = useHospitalEmergencyStatusMutation();
  const selectedDetail = useHospitalEmergency(selected ?? '');
  const items = q.data?.items ?? [];
  const summaryData = summary.data ?? { RECEIVED: 0, REVIEWING: 0, PREPARING: 0, AMBULANCE_COORDINATION: 0, RESOLVED: 0, CANCELLED: 0 };

  const resetFilters = () => {
    setStatus('');
    setSituationType('');
    setSearch('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  // Group items by the 4 active kanban stages
  const kanbanStages = [
    { id: 'RECEIVED', label: 'New / Received', items: items.filter((i) => i.status === 'RECEIVED'), badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { id: 'REVIEWING', label: 'Reviewing', items: items.filter((i) => i.status === 'REVIEWING'), badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { id: 'PREPARING', label: 'Preparing Bay', items: items.filter((i) => i.status === 'PREPARING'), badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    { id: 'AMBULANCE_COORDINATION', label: 'Ambulance Coordination', items: items.filter((i) => i.status === 'AMBULANCE_COORDINATION'), badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  ];

  return (
    <PageShell>
      <div className="space-y-6">
        <HospitalCoordinationInbox />
        <IncomingAmbulanceAlertPanel
          emergencies={items}
          onUpdateStatus={(id, status) => mutation.mutate({ id, status })}
          isUpdating={mutation.isPending}
          updatingId={mutation.variables?.id}
          onRefresh={() => void q.refetch()}
        />

        {/* 4-Column Stage Kanban Grid */}
        <section aria-label="Kanban Coordination Columns" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-400">
              Live Stage Coordination Board
            </h2>
            <span className="text-xs font-mono text-zinc-500">4 Operational Tiers</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kanbanStages.map((stage) => (
              <div
                key={stage.id}
                className="border border-white/5 bg-zinc-900/40 backdrop-blur-xl p-5 rounded-2xl space-y-3 shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <span className="text-xs font-medium text-zinc-200">{stage.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${stage.badgeColor}`}>
                    {summaryData[stage.id as keyof HospitalEmergencySummary] ?? stage.items.length}
                  </span>
                </div>

                <div className="space-y-2.5 min-h-[140px]">
                  {stage.items.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-6 text-center text-xs font-mono text-zinc-600">
                      Empty stage
                    </div>
                  ) : (
                    stage.items.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        onClick={() => setSelected(e.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          selected === e.id
                            ? 'border-rose-500/40 bg-rose-500/10 shadow-lg'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="text-zinc-200 font-bold">{e.requestCode}</span>
                          <span className="text-zinc-500">{formatElapsed(e.reportedAt)}</span>
                        </div>
                        <p className="mt-1 text-zinc-300 font-medium truncate">{e.situationType}</p>
                        <p className="mt-1 text-[11px] text-zinc-500 font-light truncate">{e.location ?? 'Jaipur Metro'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Filter Controls & List Table Container */}
        <section className={box}>
          <header className="border-b border-white/10 p-6 space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-light text-zinc-100 tracking-tight">Emergency Operations Queue</h2>
                <p className="mt-1 text-xs text-zinc-400 font-light">
                  Hospital-owned emergency intake, triage queues, and direct patient transit statuses.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                {q.data ? `Updated ${formatElapsed(q.data.items[0]?.updatedAt ?? new Date().toISOString())}` : 'Synchronizing…'}
              </span>
            </div>

            {/* Dark glass search & filters */}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="relative xl:col-span-2">
                <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search request code or patient reference…"
                  className="w-full bg-white/[0.04] border border-white/10 text-zinc-100 placeholder:text-zinc-500 rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none focus:border-rose-500/40 transition"
                />
              </div>

              <select
                aria-label="Filter status"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="rounded-xl border border-white/10 bg-zinc-900/90 text-zinc-300 px-3 py-2.5 text-xs outline-none focus:border-rose-500/40"
              >
                <option value="">All Statuses</option>
                <option value="RECEIVED">Received</option>
                <option value="REVIEWING">Reviewing</option>
                <option value="PREPARING">Preparing</option>
                <option value="AMBULANCE_COORDINATION">Ambulance Coordination</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <input
                value={situationType}
                onChange={(e) => { setSituationType(e.target.value); setPage(1); }}
                placeholder="Situation type (Trauma, Cardiac…)"
                className="rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-rose-500/40"
              />

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-rose-400" />
                <span>Reset Filters</span>
              </button>
            </div>
          </header>

          {mutation.isError && (
            <div className="border-b border-rose-500/20 bg-rose-500/10 px-5 py-3 text-xs text-rose-300" role="alert">
              Status update could not be applied. Please retry.
            </div>
          )}

          {q.isLoading ? (
            <Loading />
          ) : q.isError ? (
            <div className="p-6"><ErrorState retry={() => void q.refetch()} /></div>
          ) : items.length ? (
            <>
              <div className="divide-y divide-white/[0.06]">
                {items.map((e) => (
                  <EmergencyRow
                    key={e.id}
                    emergency={e}
                    selected={selected === e.id}
                    onSelect={() => setSelected(e.id)}
                    onStatus={(next) => mutation.mutate({ id: e.id, status: next })}
                    busy={mutation.isPending && mutation.variables?.id === e.id}
                  />
                ))}
              </div>
              <Pagination page={q.data?.pagination.page ?? 1} totalPages={q.data?.pagination.totalPages ?? 0} onPage={setPage} />
            </>
          ) : (
            <p className="p-12 text-center text-xs font-mono text-zinc-500">No emergency requests match current filters.</p>
          )}

          {selected && (
            <EmergencyDetail
              emergency={selectedDetail.data}
              isLoading={selectedDetail.isLoading}
              isError={selectedDetail.isError}
              retry={() => void selectedDetail.refetch()}
              onStatus={(next) => mutation.mutate({ id: selected, status: next })}
              busy={mutation.isPending && mutation.variables?.id === selected}
            />
          )}
        </section>
      </div>
    </PageShell>
  );
};

const EmergencyDetail = ({
  emergency,
  isLoading,
  isError,
  retry,
  onStatus,
  busy,
}: {
  emergency?: import('../types/hospitalManagement').HospitalEmergency;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  onStatus: (status: HospitalEmergencyStatus) => void;
  busy: boolean;
}) => {
  if (isLoading) return <div className="border-t border-white/10"><Loading /></div>;
  if (isError || !emergency) return <div className="border-t border-white/10 p-6"><ErrorState retry={retry} /></div>;

  const next: Record<string, HospitalEmergencyStatus | undefined> = {
    RECEIVED: 'REVIEWING',
    REVIEWING: 'PREPARING',
    PREPARING: 'AMBULANCE_COORDINATION',
    AMBULANCE_COORDINATION: 'RESOLVED',
  };
  const nextStatus = next[emergency.status];
  const hasCoordinates = emergency.latitude !== undefined && emergency.longitude !== undefined;

  return (
    <div className="border-t border-white/10 p-6 space-y-6 bg-zinc-950/60 backdrop-blur-xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Operational Detail View</p>
          <h3 className="mt-1 text-xl font-light text-zinc-100 font-mono">{emergency.requestCode}</h3>
        </div>
        <StatusBadge variant={statusVariant(emergency.status)} label={emergency.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 bg-white/[0.02] border border-white/5 p-5 rounded-xl text-xs">
        <div className="space-y-2 font-light">
          <h4 className="font-semibold text-zinc-200">Incident Details</h4>
          <p><span className="text-zinc-500">Situation:</span> <strong className="text-zinc-200">{emergency.situationType}</strong></p>
          <p><span className="text-zinc-500">Reported:</span> {new Date(emergency.reportedAt).toLocaleString()}</p>
          <p><span className="text-zinc-500">Time Elapsed:</span> {formatElapsed(emergency.reportedAt)}</p>
        </div>

        <div className="space-y-2 font-light">
          <h4 className="font-semibold text-zinc-200">Location Telemetry</h4>
          <p className="truncate">{emergency.location ?? 'Jaipur Metropolitan'}</p>
          {hasCoordinates && (
            <p className="font-mono text-zinc-400">{emergency.latitude}, {emergency.longitude}</p>
          )}
          <p><span className="text-zinc-500">Patient Ref:</span> {emergency.patientId ?? 'Anonymous / Walk-in'}</p>
        </div>

        <div className="space-y-2 font-light">
          <h4 className="font-semibold text-zinc-200">Dispatch Coordination</h4>
          <p><span className="text-zinc-500">Ambulance:</span> {emergency.ambulanceId ?? 'Auto-routing'}</p>
          <p><span className="text-zinc-500">Driver:</span> {emergency.driverId ?? 'Awaiting dispatch'}</p>
          <p><span className="text-zinc-500">ETA:</span> {emergency.etaMinutes !== undefined ? `${emergency.etaMinutes} min` : 'Standby'}</p>
          {nextStatus && (
            <div className="pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Move request to ${nextStatus}?`)) onStatus(nextStatus);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Updating…' : `Advance to ${nextStatus}`}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-white/10">
        <LiveAmbulanceTracking emergencyRequestId={emergency.id} subscribeHospitalOperations />
      </div>

      {hasCoordinates && !emergency.driverId && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80">
          <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-900/60 px-4 py-2.5 text-xs font-mono text-zinc-300">
            <MapPinned className="h-4 w-4 text-rose-500" />
            <span>Emergency Incident Coordinates &mdash; Google Maps Dark View</span>
          </div>
          <div className="h-64">
            <MapView
              center={{ latitude: emergency.latitude!, longitude: emergency.longitude! }}
              destination={{ latitude: emergency.latitude!, longitude: emergency.longitude!, name: emergency.requestCode, address: emergency.location, isEmergency: true }}
              interactive={false}
              options={{ styles: darkMapStyle }}
              styles={darkMapStyle}
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const EmergencyRow = ({
  emergency,
  selected,
  onSelect,
  onStatus,
  busy,
}: {
  emergency: import('../types/hospitalManagement').HospitalEmergency;
  selected: boolean;
  onSelect: () => void;
  onStatus: (status: HospitalEmergencyStatus) => void;
  busy: boolean;
}) => {
  const next: Record<string, HospitalEmergencyStatus | undefined> = {
    RECEIVED: 'REVIEWING',
    REVIEWING: 'PREPARING',
    PREPARING: 'AMBULANCE_COORDINATION',
    AMBULANCE_COORDINATION: 'RESOLVED',
  };
  const nextStatus = next[emergency.status];

  return (
    <div className={`p-5 transition-all cursor-pointer ${selected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}>
      <button type="button" className="w-full text-left" onClick={onSelect} aria-expanded={selected}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100">
              <span className="font-mono text-xs font-bold text-zinc-400 mr-2">{emergency.requestCode}</span>
              {emergency.situationType}
            </p>
            <p className="mt-1 text-xs text-zinc-400 font-light truncate">{emergency.location ?? 'Jaipur metropolitan jurisdiction'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs font-mono text-zinc-500">{formatElapsed(emergency.reportedAt)}</span>
            <StatusBadge variant={statusVariant(emergency.status)} label={emergency.status} />
          </div>
        </div>
      </button>

      {selected && (
        <div className="mt-3.5 pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-zinc-400 font-mono text-[11px]">
            <span>Reported {new Date(emergency.reportedAt).toLocaleTimeString()}</span>
            {emergency.etaMinutes !== undefined && <span className="ml-2 text-rose-300">· ETA {emergency.etaMinutes} min</span>}
          </div>
          {nextStatus && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Advance to ${nextStatus}?`)) onStatus(nextStatus);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Updating…' : `Advance to ${nextStatus}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── SECTION 2.B: PATIENT RECORDS ────────────────────────────────────────── */
const HospitalPatientsPage = () => {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const q = useHospitalPatients({ page, limit: 10 });
  const detail = useHospitalPatient(selected ?? '');

  return (
    <PageShell>
      <section className={box}>
        <header className="border-b border-white/10 p-6">
          <h2 className="text-xl font-light text-zinc-100 tracking-tight">Patient Intake Coordination</h2>
          <p className="mt-1 text-xs text-zinc-400 font-light">
            Operational case telemetry and trauma arrival logs &mdash; zero unrestricted medical data.
          </p>
        </header>

        {q.isLoading ? (
          <Loading />
        ) : q.isError ? (
          <div className="p-6"><ErrorState retry={() => void q.refetch()} /></div>
        ) : q.data?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-white/[0.02] border-b border-white/[0.08] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3.5">Case ID</th>
                    <th>Emergency Type</th>
                    <th>Status</th>
                    <th>ETA</th>
                    <th>Received Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {q.data.items.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={`cursor-pointer transition-all ${
                        selected === p.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-6 py-4 font-mono font-bold text-zinc-200">{p.caseId}</td>
                      <td className="text-zinc-300 font-light">{p.emergencyType}</td>
                      <td><StatusBadge variant={statusVariant(p.coordinationStatus)} label={p.coordinationStatus} /></td>
                      <td className="font-mono text-zinc-300">{p.etaMinutes !== undefined ? `${p.etaMinutes} min` : '—'}</td>
                      <td className="font-mono text-zinc-500">{new Date(p.receivedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={q.data.pagination.page} totalPages={q.data.pagination.totalPages} onPage={setPage} />
          </>
        ) : (
          <div className="p-12 text-center text-xs font-mono text-zinc-500">
            No patient coordination records currently logged.
          </div>
        )}

        {selected && (
          <div className="border-t border-white/10 p-6 bg-zinc-950/60">
            {detail.isLoading ? (
              <Loading />
            ) : detail.isError ? (
              <ErrorState retry={() => void detail.refetch()} />
            ) : detail.data ? (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-zinc-200 font-mono">Case {detail.data.caseId}</h3>
                <p className="text-xs text-zinc-400 font-light">
                  {detail.data.emergencyType} · Status: <span className="text-rose-300">{detail.data.coordinationStatus}</span>
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </PageShell>
  );
};

/* ─── SECTION 2.B: AMBULANCE OPERATIONS ───────────────────────────────────── */
const HospitalAmbulancesPage = () => {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const q = useHospitalAmbulances({ page, limit: 10, status: status || undefined });
  const detail = useHospitalAmbulance(selected ?? '');

  return (
    <PageShell>
      <section className={box}>
        <header className="flex flex-col gap-3 border-b border-white/10 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-light text-zinc-100 tracking-tight">Ambulance Fleet Coordination</h2>
            <p className="mt-1 text-xs text-zinc-400 font-light">
              Emergency transport units linked directly to active hospital admissions.
            </p>
          </div>
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-xl border border-white/10 bg-zinc-900/90 text-zinc-300 px-3.5 py-2 text-xs outline-none focus:border-rose-500/40"
          >
            <option value="">All Fleet Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="BUSY">Busy</option>
            <option value="OFFLINE">Offline</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </header>

        {q.isLoading ? (
          <Loading />
        ) : q.isError ? (
          <div className="p-6"><ErrorState retry={() => void q.refetch()} /></div>
        ) : q.data?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="bg-white/[0.02] border-b border-white/[0.08] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3.5">Ambulance</th>
                    <th>Provider</th>
                    <th>Driver</th>
                    <th>Status</th>
                    <th>Live GPS</th>
                    <th>Arrival ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {q.data.items.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelected(a.id)}
                      className={`cursor-pointer transition-all ${
                        selected === a.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-6 py-4 font-mono font-bold text-zinc-200">
                        {a.registrationNumber}
                        <span className="block text-[10px] font-normal text-zinc-500">{a.vehicleNumber}</span>
                      </td>
                      <td className="text-zinc-300">{a.provider?.name ?? '—'}</td>
                      <td className="text-zinc-300">{a.driver?.name ?? '—'}</td>
                      <td><StatusBadge variant={statusVariant(a.currentStatus)} label={a.currentStatus} /></td>
                      <td className="font-mono text-zinc-400">
                        {a.currentLatitude !== undefined && a.currentLongitude !== undefined
                          ? `${a.currentLatitude.toFixed(4)}, ${a.currentLongitude.toFixed(4)}`
                          : 'Awaiting signal'}
                      </td>
                      <td className="font-mono text-zinc-300">{a.etaMinutes !== undefined ? `${a.etaMinutes} min` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={q.data.pagination.page} totalPages={q.data.pagination.totalPages} onPage={setPage} />
          </>
        ) : (
          <p className="p-12 text-center text-xs font-mono text-zinc-500">
            No active ambulance fleet units connected to hospital dispatch.
          </p>
        )}

        {selected && (
          <div className="border-t border-white/10 p-6 bg-zinc-950/60">
            {detail.isLoading ? (
              <Loading />
            ) : detail.isError ? (
              <ErrorState retry={() => void detail.refetch()} />
            ) : detail.data ? (
              <div className="space-y-1.5">
                <h3 className="font-medium text-sm text-zinc-200 font-mono">Ambulance {detail.data.registrationNumber}</h3>
                <p className="text-xs text-zinc-400 font-light">
                  {detail.data.ambulanceType} · Provider: {detail.data.provider?.name ?? 'Assigned Partner'}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </PageShell>
  );
};

/* ─── SECTION 2.C: BED MANAGEMENT, AVAILABILITY & SERVICES ────────────────── */
const HospitalResourcesPage = () => {
  const q = useHospitalResources();
  const mutation = useHospitalResourcesMutation();
  const profile = useHospitalProfile();
  const [values, setValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (q.data) setValues(q.data.resourceSummary);
  }, [q.data]);

  const entries = Object.entries(values);

  return (
    <PageShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs font-mono font-medium text-teal-300 mb-2">
              <BedDouble className="w-3.5 h-3.5 text-teal-400" />
              <span>Real-Time Bed & Resource Telemetry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight">
              Hospital Capacity & Operations
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-light mt-1">
              Configure active ICU beds, trauma bays, and operational department services across sectors.
            </p>
          </div>
          {q.data && <Freshness value={q.data.updatedAt} />}
        </div>

        {/* Capacity Overview: Open Bento Grid with Spotlight Hover Cards */}
        {entries.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300 shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                    {key.replace(/[_-]/g, ' ')}
                  </span>
                  <div className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300">
                    <BedDouble className="h-4 w-4 text-rose-400" />
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-2">
                  <div className="text-3xl font-mono font-light text-zinc-100">
                    {value}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Realtime Active
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2">
                  <label className="text-xs text-zinc-400 flex-1">Adjust Quantity:</label>
                  <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) => setValues((current) => ({ ...current, [key]: Number(e.target.value) }))}
                    className="w-20 rounded-xl bg-white/[0.04] border border-white/10 text-right px-3 py-1.5 text-xs text-zinc-100 font-mono outline-none focus:border-rose-500/40"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Subtle Dark Glass Wireframe Card for Unconfigured Resource States */
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center text-zinc-500 text-sm space-y-3 shadow-xl backdrop-blur-xl">
            <Layers className="mx-auto h-8 w-8 text-zinc-600" />
            <p className="font-medium text-zinc-300">No Resource Allocation Configured</p>
            <p className="text-xs max-w-md mx-auto text-zinc-500 font-light">
              Add operational department beds, trauma bays, or ventilators to broadcast real-time availability across the emergency response network.
            </p>
          </div>
        )}

        {/* Save Bar */}
        {entries.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-mono text-zinc-500">
              Updates reflect immediately on citizen search and ambulance routing engines.
            </span>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(values)}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-lg shadow-rose-950/40 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{mutation.isPending ? 'Saving Capacity…' : 'Save Resources'}</span>
            </button>
          </div>
        )}

        {/* Operations Settings Sub-component */}
        {profile.data && <OperationsSettings profile={profile.data} />}
      </div>
    </PageShell>
  );
};

/* ─── SECTION 2.C: OPERATIONS SETTINGS & DEPARTMENTS ──────────────────────── */
const OperationsSettings = ({
  profile,
}: {
  profile: import('../types/hospitalManagement').HospitalProfile;
}) => {
  const services = useHospitalServices();
  const capabilities = useHospitalCapabilities();
  const availability = useHospitalAvailability();
  const serviceMutation = useHospitalServicesMutation();
  const capabilityMutation = useHospitalCapabilitiesMutation();
  const availabilityMutation = useHospitalAvailabilityMutation();

  const [serviceText, setServiceText] = useState('');
  const [capabilityText, setCapabilityText] = useState('');

  useEffect(() => {
    if (services.data) setServiceText(services.data.services.join(', '));
  }, [services.data]);
  useEffect(() => {
    if (capabilities.data) setCapabilityText(capabilities.data.capabilities.join(', '));
  }, [capabilities.data]);

  return (
    <section className={`${box} p-6 sm:p-8 space-y-6`}>
      <div className="border-b border-white/10 pb-4">
        <h3 className="text-lg font-light text-zinc-100 tracking-tight">Operations Configuration</h3>
        <p className="mt-1 text-xs text-zinc-400 font-light">
          Maintain verified clinical services, emergency capabilities, and global dispatch availability.
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
            Clinical Services (Comma Separated)
          </label>
          <input
            value={serviceText}
            onChange={(e) => setServiceText(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-rose-500/40"
            placeholder="Emergency Department, Intensive Care Unit, Interventional Cardiology, Radiology"
          />
          <button
            type="button"
            disabled={serviceMutation.isPending}
            onClick={() =>
              serviceMutation.mutate(
                serviceText.split(',').map((x) => x.trim()).filter(Boolean)
              )
            }
            className="mt-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/10 transition cursor-pointer"
          >
            {serviceMutation.isPending ? 'Saving…' : 'Save Services'}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
            Trauma & Specialty Capabilities
          </label>
          <input
            value={capabilityText}
            onChange={(e) => setCapabilityText(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-rose-500/40"
            placeholder="Level 1 Trauma, Pediatric Emergency, Stroke Center, Burn Unit"
          />
          <button
            type="button"
            disabled={capabilityMutation.isPending}
            onClick={() =>
              capabilityMutation.mutate(
                capabilityText.split(',').map((x) => x.trim()).filter(Boolean)
              )
            }
            className="mt-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/10 transition cursor-pointer"
          >
            {capabilityMutation.isPending ? 'Saving…' : 'Save Capabilities'}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
            Emergency Admission Status
          </label>
          <select
            value={availability.data?.emergencyAvailability ?? profile.emergencyAvailability}
            onChange={(e) => availabilityMutation.mutate(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/90 text-zinc-200 px-4 py-3 text-xs outline-none focus:border-rose-500/40"
          >
            <option value="AVAILABLE">Available & Accepting Emergency Patients</option>
            <option value="LIMITED">Limited Capacity (Triage Only)</option>
            <option value="UNAVAILABLE">Unavailable / Full Diversion</option>
            <option value="UNKNOWN">Standby / Unspecified</option>
          </select>
          <Freshness value={availability.data?.updatedAt ?? profile.updatedAt} />
        </div>
      </div>
    </section>
  );
};

/* ─── SECTION 2.B: HOSPITAL PROFILE ───────────────────────────────────────── */
const HospitalProfilePage = () => {
  const q = useHospitalProfile();
  const mutation = useHospitalProfileMutation();
  const [form, setForm] = useState<HospitalProfileUpdate>({});

  useEffect(() => {
    if (q.data) {
      setForm({
        name: q.data.name,
        phone: q.data.phone,
        address: q.data.address ?? '',
        city: q.data.city ?? '',
        state: q.data.state ?? '',
        country: q.data.country ?? '',
        hospitalType: q.data.hospitalType,
        publicContactInformation: q.data.publicContactInformation ?? '',
        operationalDescription: q.data.operationalDescription ?? '',
      });
    }
  }, [q.data]);

  if (q.isLoading) return <PageShell><Loading /></PageShell>;
  if (q.isError || !q.data) return <PageShell><ErrorState retry={() => void q.refetch()} /></PageShell>;
  const p = q.data;

  const field = (label: string, key: string) => (
    <label className="space-y-1.5 text-xs">
      <span className="font-mono uppercase tracking-wider text-zinc-400 block">{label}</span>
      <input
        value={String(form[key as keyof HospitalProfileUpdate] ?? '')}
        onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-rose-500/40"
      />
    </label>
  );

  return (
    <PageShell>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${box} p-6 sm:p-8 space-y-6`}>
          <div className="flex items-center gap-4 border-b border-white/10 pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-light text-zinc-100 tracking-tight">{p.name}</h2>
              <p className="text-xs font-mono text-zinc-500">{p.registrationNumber}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field('Hospital Name', 'name')}
            {field('Emergency Phone', 'phone')}
            {field('Address', 'address')}
            {field('City', 'city')}
            {field('State / Province', 'state')}
            {field('Country', 'country')}
            {field('Facility Type', 'hospitalType')}
            {field('Public Contact', 'publicContactInformation')}
          </div>

          <label className="block space-y-1.5 text-xs">
            <span className="font-mono uppercase tracking-wider text-zinc-400 block">Operational Description</span>
            <textarea
              value={form.operationalDescription ?? ''}
              onChange={(e) => setForm((current) => ({ ...current, operationalDescription: e.target.value }))}
              rows={4}
              className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-2.5 text-xs text-zinc-100 outline-none focus:border-rose-500/40"
            />
          </label>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <StatusBadge variant={statusVariant(p.verificationStatus)} label={`Verification: ${p.verificationStatus}`} />
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(form)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-lg shadow-rose-950/40 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{mutation.isPending ? 'Saving…' : 'Save Profile'}</span>
            </button>
          </div>
        </section>

        <OperationsSettings profile={p} />
      </div>
    </PageShell>
  );
};

const Pagination = ({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) => (
  <div className="flex items-center justify-between border-t border-white/10 p-5 text-xs font-mono text-zinc-400">
    <span>Page {page} of {Math.max(totalPages, 1)}</span>
    <div className="flex gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 disabled:opacity-40 transition cursor-pointer"
      >
        Previous
      </button>
      <button
        type="button"
        disabled={page >= totalPages || totalPages === 0}
        onClick={() => onPage(page + 1)}
        className="px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 disabled:opacity-40 transition cursor-pointer"
      >
        Next
      </button>
    </div>
  </div>
);
