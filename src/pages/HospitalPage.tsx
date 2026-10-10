/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, type ReactNode } from 'react';
import { Ambulance, Building2, CalendarDays, Check, CircleAlert, MapPinned, RefreshCw, Save, Search, UserRound } from 'lucide-react';
import { Button } from '../components/common/Button';
import type { HospitalProfileUpdate } from '../services/hospitalApi';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  useHospitalAmbulances, useHospitalAvailability, useHospitalAvailabilityMutation,
  useHospitalCapabilities, useHospitalCapabilitiesMutation, useHospitalEmergencyStatusMutation,
  useHospitalEmergencies, useHospitalEmergency, useHospitalEmergencySummary, useHospitalPatients, useHospitalPatient, useHospitalProfile, useHospitalProfileMutation,
  useHospitalResources, useHospitalResourcesMutation, useHospitalServices, useHospitalServicesMutation, useHospitalAmbulance,
} from '../hooks/useHospitalManagement';
import type { HospitalEmergencyStatus, HospitalEmergencySummary } from '../types/hospitalManagement';
import { MapView } from '../components/map/MapView';
import { LiveAmbulanceTracking } from '../components/LiveAmbulanceTracking';
import { IncomingAmbulanceAlertPanel } from '../components/hospital/IncomingAmbulanceAlertPanel';

const wrap = 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8';
const box = 'border border-slate-200 bg-white';
const ErrorState = ({ retry }: { retry: () => void }) => <div className="flex items-center justify-between gap-4 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>Unable to load hospital data.</span><Button size="sm" variant="secondary" onClick={retry} icon={<RefreshCw className="h-4 w-4" />}>Retry</Button></div>;
const Loading = () => <div className="p-8 text-center text-sm text-slate-500">Loading hospital data…</div>;
const Freshness = ({ value }: { value?: string }) => <p className="text-xs text-slate-400">{value ? `Updated ${new Date(value).toLocaleString()}` : 'Update time unavailable'}</p>;
const PageShell = ({ children }: { children: ReactNode }) => <div className={wrap}>{children}</div>;

const availabilityLabel: Record<string, string> = { AVAILABLE: 'Available', LIMITED: 'Limited', UNAVAILABLE: 'Unavailable', UNKNOWN: 'Unknown' };
const statusVariant = (value: string): 'verified' | 'waitTime' | 'neutral' => value === 'AVAILABLE' || value === 'VERIFIED' || value === 'RESOLVED' ? 'verified' : value === 'UNAVAILABLE' || value === 'CANCELLED' ? 'neutral' : 'waitTime';

export const HospitalPage = () => {
  const path = window.location.pathname;

  if (path === '/hospital/emergencies') return <HospitalEmergenciesPage />;
  if (path === '/hospital/patients') return <HospitalPatientsPage />;
  if (path === '/hospital/ambulances') return <HospitalAmbulancesPage />;
  if (path === '/hospital/resources') return <HospitalResourcesPage />;
  if (path === '/hospital/profile') return <HospitalProfilePage />;
  return <HospitalOverviewPage />;
};

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
    ['Emergency availability', availabilityLabel[p.emergencyAvailability] ?? p.emergencyAvailability, CircleAlert],
    ['Incoming requests', emergencies.data?.pagination.total ?? 0, CircleAlert],
    ['Coordination cases', patients.data?.pagination.total ?? 0, UserRound],
    ['Ambulances', ambulances.data?.pagination.total ?? 0, Ambulance],
  ] as const;
  return <PageShell>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">Hospital Operations</p><h2 className="mt-1 text-2xl font-semibold">{p.name}</h2><p className="mt-1 text-sm text-slate-500">{p.address ?? 'Address not provided'}{p.city ? `, ${p.city}` : ''}</p></div><StatusBadge variant={statusVariant(p.verificationStatus)} label={p.verificationStatus} /></div>
    <div className="mt-6">
      <IncomingAmbulanceAlertPanel
        emergencies={emergencies.data?.items ?? []}
        onUpdateStatus={(id, status) => statusMutation.mutate({ id, status })}
        isUpdating={statusMutation.isPending}
        updatingId={statusMutation.variables?.id}
        onRefresh={() => void emergencies.refetch()}
      />
    </div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value, Icon]) => <div key={label} className={`${box} p-4`}><div className="flex justify-between"><p className="text-sm text-slate-500">{label}</p><Icon className="h-4 w-4 text-slate-400" /></div><p className="mt-3 text-2xl font-semibold">{value}</p></div>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className={box}><header className="border-b border-slate-200 p-4"><h3 className="font-semibold">Emergency operations</h3><Freshness value={p.updatedAt} /></header>{emergencies.isError ? <ErrorState retry={() => void emergencies.refetch()} /> : emergencies.data?.items.length ? emergencies.data.items.map((e) => <div key={e.id} className="border-b border-slate-100 p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{e.requestCode} · {e.situationType}</p><p className="mt-1 text-sm text-slate-500">{e.location ?? 'Location not provided'}</p></div><StatusBadge variant={statusVariant(e.status)} label={e.status} /></div><p className="mt-3 text-xs text-slate-500">Received {new Date(e.reportedAt).toLocaleString()}{e.etaMinutes !== undefined ? ` · ETA ${e.etaMinutes} min` : ''}</p></div>) : <p className="p-6 text-sm text-slate-500">No incoming emergency requests.</p>}</section>
      <section className={box}><header className="border-b border-slate-200 p-4"><h3 className="font-semibold">Current resources</h3><Freshness value={p.updatedAt} /></header>{Object.keys(p.resourceSummary).length ? Object.entries(p.resourceSummary).map(([key, value]) => <div key={key} className="flex items-center justify-between border-b border-slate-100 p-4"><span className="text-sm font-medium capitalize">{key.replace(/[_-]/g, ' ')}</span><span className="text-sm font-semibold">{value}</span></div>) : <p className="p-6 text-sm text-slate-500">No resource data has been configured.</p>}</section>
    </div>
  </PageShell>;
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

const summaryItems: Array<{ key: keyof HospitalEmergencySummary; label: string }> = [
  { key: 'RECEIVED', label: 'New / Received' },
  { key: 'REVIEWING', label: 'Reviewing' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'AMBULANCE_COORDINATION', label: 'Ambulance Coordination' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

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

  return <PageShell>
    <div className="space-y-4">
      <IncomingAmbulanceAlertPanel
        emergencies={items}
        onUpdateStatus={(id, status) => mutation.mutate({ id, status })}
        isUpdating={mutation.isPending}
        updatingId={mutation.variables?.id}
        onRefresh={() => void q.refetch()}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Emergency queue summary">
        {summaryItems.map(({ key, label }) => (
          <div key={key} className={`${box} p-4`}>
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{summaryData[key]}</p>
          </div>
        ))}
      </section>

      <section className={box}>
        <header className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Emergency Operations Queue</h2>
              <p className="mt-1 text-sm text-slate-500">Hospital-owned emergency requests, ordered by operational status and recency.</p>
            </div>
            <span className="text-xs text-slate-400" aria-live="polite">{q.data ? `Updated ${formatElapsed(q.data.items[0]?.updatedAt ?? new Date().toISOString())}` : 'Updating…'}</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="relative block xl:col-span-2">
              <span className="sr-only">Search request code or patient reference</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search request code or patient reference" className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10" />
            </label>
            <label>
              <span className="sr-only">Status</span>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                <option value="">All statuses</option><option value="RECEIVED">Received</option><option value="REVIEWING">Reviewing</option><option value="PREPARING">Preparing</option><option value="AMBULANCE_COORDINATION">Ambulance coordination</option><option value="RESOLVED">Resolved</option><option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Situation type</span>
              <input value={situationType} onChange={(e) => { setSituationType(e.target.value); setPage(1); }} placeholder="Situation type" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10" />
            </label>
            <button type="button" onClick={resetFilters} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Reset filters</button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:max-w-xl">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <CalendarDays className="h-4 w-4 text-slate-400" /><span className="text-xs text-slate-500">From</span>
              <input aria-label="From date" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="min-w-0 flex-1 outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <CalendarDays className="h-4 w-4 text-slate-400" /><span className="text-xs text-slate-500">To</span>
              <input aria-label="To date" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="min-w-0 flex-1 outline-none" />
            </label>
          </div>
        </header>

        {mutation.isError && <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">Status update could not be applied. The request was refreshed; please retry only if the current status still permits the action.</div>}
        {q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => void q.refetch()} /> : items.length ? <>
          <div className="divide-y divide-slate-100">
            {items.map((e) => <EmergencyRow key={e.id} emergency={e} selected={selected === e.id} onSelect={() => setSelected(e.id)} onStatus={(next) => mutation.mutate({ id: e.id, status: next })} busy={mutation.isPending && mutation.variables?.id === e.id} />)}
          </div>
          <Pagination page={q.data?.pagination.page ?? 1} totalPages={q.data?.pagination.totalPages ?? 0} onPage={setPage} />
        </> : <p className="p-8 text-center text-sm text-slate-500">No emergency requests found.</p>}

        {selected && <EmergencyDetail emergency={selectedDetail.data} isLoading={selectedDetail.isLoading} isError={selectedDetail.isError} retry={() => void selectedDetail.refetch()} onStatus={(next) => mutation.mutate({ id: selected, status: next })} busy={mutation.isPending && mutation.variables?.id === selected} />}
      </section>
    </div>
  </PageShell>;
};

const EmergencyDetail = ({ emergency, isLoading, isError, retry, onStatus, busy }: { emergency?: import('../types/hospitalManagement').HospitalEmergency; isLoading: boolean; isError: boolean; retry: () => void; onStatus: (status: HospitalEmergencyStatus) => void; busy: boolean }) => {
  if (isLoading) return <div className="border-t border-slate-200"><Loading /></div>;
  if (isError || !emergency) return <div className="border-t border-slate-200 p-4"><ErrorState retry={retry} /></div>;
  const next: Record<string, HospitalEmergencyStatus | undefined> = { RECEIVED: 'REVIEWING', REVIEWING: 'PREPARING', PREPARING: 'AMBULANCE_COORDINATION', AMBULANCE_COORDINATION: 'RESOLVED' };
  const nextStatus = next[emergency.status];
  const hasCoordinates = emergency.latitude !== undefined && emergency.longitude !== undefined;
  return <div className="border-t border-slate-200 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs uppercase tracking-wide text-slate-500">Emergency detail</p><h3 className="mt-1 text-lg font-semibold">{emergency.requestCode}</h3></div>
      <StatusBadge variant={statusVariant(emergency.status)} label={emergency.status} />
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 text-sm"><h4 className="font-semibold">Request</h4><p><span className="text-slate-500">Situation:</span> {emergency.situationType}</p><p><span className="text-slate-500">Reported:</span> {new Date(emergency.reportedAt).toLocaleString()}</p><p><span className="text-slate-500">Created:</span> {new Date(emergency.createdAt).toLocaleString()}</p><p><span className="text-slate-500">Last updated:</span> {new Date(emergency.updatedAt).toLocaleString()}</p><p><span className="text-slate-500">Time since request:</span> {formatElapsed(emergency.reportedAt)}</p></div>
      <div className="space-y-3 text-sm"><h4 className="font-semibold">Location</h4><p>{emergency.location ?? 'Location label not provided'}</p>{hasCoordinates ? <p className="font-mono text-xs text-slate-500">{emergency.latitude}, {emergency.longitude}</p> : <p className="text-slate-500">Coordinates not available.</p>}<h4 className="pt-2 font-semibold">Patient</h4><p>{emergency.patientId ?? 'Patient reference not available'}</p></div>
      <div className="space-y-3 text-sm"><h4 className="font-semibold">Coordination</h4><p>Ambulance: {emergency.ambulanceId ?? 'Not assigned'}</p><p>Provider: {emergency.ambulanceProviderId ?? 'Not assigned'}</p><p>Driver: {emergency.driverId ?? 'Not assigned'}</p><p>ETA: {emergency.etaMinutes !== undefined ? `${emergency.etaMinutes} min` : 'Not available'}</p><div className="flex flex-wrap gap-2 pt-2">{nextStatus && <Button size="sm" disabled={busy} onClick={() => { if (window.confirm(`Change status to ${nextStatus}?`)) onStatus(nextStatus); }} icon={<Check className="h-4 w-4" />}>{busy ? 'Updating…' : `Move to ${nextStatus}`}</Button>}{emergency.status === 'PREPARING' && <span className="text-xs text-slate-500">Ambulance assignment remains in the existing ambulance operations workflow.</span>}</div></div>
    </div>
    <div className="mt-4"><LiveAmbulanceTracking emergencyRequestId={emergency.id} subscribeHospitalOperations /></div>
    {hasCoordinates && !emergency.driverId && <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"><MapPinned className="h-4 w-4" /> Emergency location — Google Maps</div>
      <div className="h-64"><MapView center={{ latitude: emergency.latitude!, longitude: emergency.longitude! }} destination={{ latitude: emergency.latitude!, longitude: emergency.longitude!, name: emergency.requestCode, address: emergency.location, isEmergency: true }} interactive={false} className="h-full" /></div>
    </div>}
  </div>;
};

const EmergencyRow = ({ emergency, selected, onSelect, onStatus, busy }: { emergency: import('../types/hospitalManagement').HospitalEmergency; selected: boolean; onSelect: () => void; onStatus: (status: HospitalEmergencyStatus) => void; busy: boolean }) => {
  const next: Record<string, HospitalEmergencyStatus | undefined> = { RECEIVED: 'REVIEWING', REVIEWING: 'PREPARING', PREPARING: 'AMBULANCE_COORDINATION', AMBULANCE_COORDINATION: 'RESOLVED' };
  const nextStatus = next[emergency.status];
  return <div className={`border-b border-slate-100 p-4 ${selected ? 'bg-slate-50' : ''}`}>
    <button type="button" className="w-full text-left" onClick={onSelect} aria-expanded={selected}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="truncate font-semibold">{emergency.requestCode} · {emergency.situationType}</p><p className="mt-1 text-sm text-slate-500">{emergency.location ?? 'Location not provided'}</p></div>
        <div className="flex shrink-0 items-center gap-3"><span className="text-xs text-slate-400">{formatElapsed(emergency.reportedAt)}</span><StatusBadge variant={statusVariant(emergency.status)} label={emergency.status} /></div>
      </div>
    </button>
    {selected && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span>Reported {new Date(emergency.reportedAt).toLocaleString()}</span>{emergency.etaMinutes !== undefined && <span>ETA {emergency.etaMinutes} min</span>}{nextStatus && <Button size="sm" disabled={busy} onClick={() => { if (window.confirm(`Change status to ${nextStatus}?`)) onStatus(nextStatus); }} icon={<Check className="h-4 w-4" />}>{busy ? 'Updating…' : `Move to ${nextStatus}`}</Button>}</div>}
  </div>;
};

const HospitalPatientsPage = () => {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const q = useHospitalPatients({ page, limit: 10 });
  const detail = useHospitalPatient(selected ?? '');
  return <PageShell><section className={box}><header className="border-b border-slate-200 p-4"><h2 className="text-lg font-semibold">Patient Coordination</h2><p className="mt-1 text-sm text-slate-500">Operational case information only; no unrestricted medical records.</p></header>{q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => void q.refetch()} /> : q.data?.items.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Case</th><th>Emergency</th><th>Status</th><th>ETA</th><th>Received</th></tr></thead><tbody className="divide-y divide-slate-100">{q.data.items.map((p) => <tr key={p.id} onClick={() => setSelected(p.id)} className="cursor-pointer hover:bg-slate-50"><td className="px-4 py-4 font-semibold">{p.caseId}</td><td>{p.emergencyType}</td><td><StatusBadge variant={statusVariant(p.coordinationStatus)} label={p.coordinationStatus} /></td><td>{p.etaMinutes !== undefined ? `${p.etaMinutes} min` : '—'}</td><td>{new Date(p.receivedAt).toLocaleString()}</td></tr>)}</tbody></table></div><Pagination page={q.data.pagination.page} totalPages={q.data.pagination.totalPages} onPage={setPage} /></> : <p className="p-8 text-center text-sm text-slate-500">No patient coordination records are available.</p>}{selected && <div className="border-t border-slate-200 p-4">{detail.isLoading ? <Loading /> : detail.isError ? <ErrorState retry={() => void detail.refetch()} /> : detail.data ? <div><h3 className="font-semibold">Case {detail.data.caseId}</h3><p className="mt-2 text-sm text-slate-500">{detail.data.emergencyType} · {detail.data.coordinationStatus}</p></div> : null}</div>}</section></PageShell>;
};

const HospitalAmbulancesPage = () => {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const q = useHospitalAmbulances({ page, limit: 10, status: status || undefined });
  const detail = useHospitalAmbulance(selected ?? '');
  return <PageShell><section className={box}><header className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold">Ambulance Coordination</h2><p className="mt-1 text-sm text-slate-500">Only ambulances linked to this hospital's coordination requests are shown.</p></div><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="">All statuses</option><option value="AVAILABLE">Available</option><option value="BUSY">Busy</option><option value="OFFLINE">Offline</option><option value="MAINTENANCE">Maintenance</option></select></header>{q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => void q.refetch()} /> : q.data?.items.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Ambulance</th><th>Provider</th><th>Driver</th><th>Status</th><th>Location</th><th>ETA</th></tr></thead><tbody className="divide-y divide-slate-100">{q.data.items.map((a) => <tr key={a.id} onClick={() => setSelected(a.id)} className="cursor-pointer hover:bg-slate-50"><td className="px-4 py-4 font-semibold">{a.registrationNumber}<span className="block text-xs font-normal text-slate-400">{a.vehicleNumber}</span></td><td>{a.provider?.name ?? '—'}</td><td>{a.driver?.name ?? '—'}</td><td><StatusBadge variant={statusVariant(a.currentStatus)} label={a.currentStatus} /></td><td>{a.currentLatitude !== undefined && a.currentLongitude !== undefined ? `${a.currentLatitude}, ${a.currentLongitude}` : 'Not available'}</td><td>{a.etaMinutes !== undefined ? `${a.etaMinutes} min` : '—'}</td></tr>)}</tbody></table></div><Pagination page={q.data.pagination.page} totalPages={q.data.pagination.totalPages} onPage={setPage} /></> : <p className="p-8 text-center text-sm text-slate-500">No ambulances are currently associated with hospital coordination.</p>}{selected && <div className="border-t border-slate-200 p-4">{detail.isLoading ? <Loading /> : detail.isError ? <ErrorState retry={() => void detail.refetch()} /> : detail.data ? <div><h3 className="font-semibold">Ambulance {detail.data.registrationNumber}</h3><p className="mt-2 text-sm text-slate-500">{detail.data.ambulanceType} · {detail.data.currentStatus} · {detail.data.provider?.name ?? 'Provider unavailable'}</p></div> : null}</div>}</section></PageShell>;
};

const HospitalResourcesPage = () => {
  const q = useHospitalResources();
  const mutation = useHospitalResourcesMutation();
  const [values, setValues] = useState<Record<string, number>>({});
  useEffect(() => { if (q.data) setValues(q.data.resourceSummary); }, [q.data]);
  const entries = Object.entries(values);
  return <PageShell><section className={`${box} max-w-3xl`}><header className="border-b border-slate-200 p-4"><h2 className="text-lg font-semibold">Hospital Resources</h2>{q.data && <Freshness value={q.data.updatedAt} />}</header>{q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => void q.refetch()} /> : entries.length ? <>{entries.map(([key, value]) => <div key={key} className="grid grid-cols-[1fr_120px] items-center gap-4 border-b border-slate-100 p-4"><label className="text-sm font-medium capitalize">{key.replace(/[_-]/g, ' ')}<span className="block text-xs font-normal text-slate-400">Operational availability only</span></label><input type="number" min="0" value={value} onChange={(e) => setValues((current) => ({ ...current, [key]: Number(e.target.value) }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm" /></div>)}<div className="flex items-center justify-between p-4"><span className="text-xs text-slate-500">Values are informational and may change.</span><Button disabled={mutation.isPending} onClick={() => mutation.mutate(values)} icon={<Save className="h-4 w-4" />}>{mutation.isPending ? 'Saving…' : 'Save resources'}</Button></div></> : <p className="p-8 text-center text-sm text-slate-500">No resources configured.</p>}</section></PageShell>;
};

const HospitalProfilePage = () => {
  const q = useHospitalProfile();
  const mutation = useHospitalProfileMutation();
  const [form, setForm] = useState<HospitalProfileUpdate>({});
  useEffect(() => { if (q.data) setForm({ name: q.data.name, phone: q.data.phone, address: q.data.address ?? '', city: q.data.city ?? '', state: q.data.state ?? '', country: q.data.country ?? '', hospitalType: q.data.hospitalType, publicContactInformation: q.data.publicContactInformation ?? '', operationalDescription: q.data.operationalDescription ?? '' }); }, [q.data]);
  if (q.isLoading) return <PageShell><Loading /></PageShell>;
  if (q.isError || !q.data) return <PageShell><ErrorState retry={() => void q.refetch()} /></PageShell>;
  const p = q.data;
  const field = (label: string, key: string) => <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">{label}</span><input value={String(form[key as keyof HospitalProfileUpdate] ?? '')} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} className="w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" /></label>;
  return <PageShell><div className="grid gap-6 lg:grid-cols-2"><section className={`${box} p-5`}><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100"><Building2 className="h-6 w-6" /></div><div><h2 className="text-xl font-semibold">{p.name}</h2><p className="text-sm text-slate-500">{p.registrationNumber}</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{field('Name', 'name')}{field('Phone', 'phone')}{field('Address', 'address')}{field('City', 'city')}{field('State', 'state')}{field('Country', 'country')}{field('Hospital type', 'hospitalType')}{field('Public contact', 'publicContactInformation')}</div><label className="mt-4 block space-y-1 text-sm"><span className="font-medium text-slate-700">Operational description</span><textarea value={form.operationalDescription ?? ''} onChange={(e) => setForm((current) => ({ ...current, operationalDescription: e.target.value }))} rows={4} className="w-full rounded-md border border-slate-200 px-3 py-2" /></label><div className="mt-5 flex items-center justify-between"><div><StatusBadge variant={statusVariant(p.verificationStatus)} label={`Verification: ${p.verificationStatus}`} /><p className="mt-2 text-xs text-slate-500">Account status: {p.accountStatus}. Admin controls verification and account status.</p></div><Button disabled={mutation.isPending} onClick={() => mutation.mutate(form)} icon={<Save className="h-4 w-4" />}>{mutation.isPending ? 'Saving…' : 'Save profile'}</Button></div></section><OperationsSettings profile={p} /></div></PageShell>;
};

const OperationsSettings = ({ profile }: { profile: import('../types/hospitalManagement').HospitalProfile }) => {
  const services = useHospitalServices();
  const capabilities = useHospitalCapabilities();
  const availability = useHospitalAvailability();
  const serviceMutation = useHospitalServicesMutation();
  const capabilityMutation = useHospitalCapabilitiesMutation();
  const availabilityMutation = useHospitalAvailabilityMutation();
  const [serviceText, setServiceText] = useState('');
  const [capabilityText, setCapabilityText] = useState('');
  useEffect(() => { if (services.data) setServiceText(services.data.services.join(', ')); }, [services.data]);
  useEffect(() => { if (capabilities.data) setCapabilityText(capabilities.data.capabilities.join(', ')); }, [capabilities.data]);
  return <section className={`${box} p-5`}><h3 className="text-lg font-semibold">Operations configuration</h3><p className="mt-1 text-sm text-slate-500">Maintain factual services, capabilities and emergency availability.</p><div className="mt-6 space-y-6"><div><label className="text-sm font-medium">Services</label><input value={serviceText} onChange={(e) => setServiceText(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Emergency Department, ICU, Radiology" /><Button className="mt-2" size="sm" disabled={serviceMutation.isPending} onClick={() => serviceMutation.mutate(serviceText.split(',').map((x) => x.trim()).filter(Boolean))}>{serviceMutation.isPending ? 'Saving…' : 'Save services'}</Button></div><div><label className="text-sm font-medium">Capabilities</label><input value={capabilityText} onChange={(e) => setCapabilityText(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Trauma capability, ICU capability" /><Button className="mt-2" size="sm" disabled={capabilityMutation.isPending} onClick={() => capabilityMutation.mutate(capabilityText.split(',').map((x) => x.trim()).filter(Boolean))}>{capabilityMutation.isPending ? 'Saving…' : 'Save capabilities'}</Button></div><div><label className="text-sm font-medium">Emergency availability</label><select value={availability.data?.emergencyAvailability ?? profile.emergencyAvailability} onChange={(e) => availabilityMutation.mutate(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"><option value="AVAILABLE">Available</option><option value="LIMITED">Limited</option><option value="UNAVAILABLE">Unavailable</option><option value="UNKNOWN">Unknown</option></select><Freshness value={availability.data?.updatedAt ?? profile.updatedAt} /></div></div></section>;
};

const Pagination = ({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) => <div className="flex items-center justify-between border-t border-slate-200 p-4"><span className="text-xs text-slate-500">Page {page} of {Math.max(totalPages, 1)}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page >= totalPages || totalPages === 0} onClick={() => onPage(page + 1)}>Next</Button></div></div>;
