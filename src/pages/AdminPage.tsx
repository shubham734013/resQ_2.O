import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { AdminPage, MetricGrid, Panel } from '../components/admin/AdminPrimitives';
import { CategoryChart, TrendChart } from '../components/admin/AdminCharts';
import { EmergencyTable } from '../components/admin/AdminTables';
import { Button } from '../components/common/Button';
import {
  useAdminAmbulances,
  useAdminDrivers,
  useAdminEmergencies,
  useAdminHospitals,
  useAdminOverview,
  useAdminProviders,
  useAdminReportOverview,
  useAdminEmergencyReports,
  useAdminAnalytics,
  useAdminUsers,
  useUpdateDriverStatus,
  useUpdateDriverVerification,
  useUpdateHospitalStatus,
  useUpdateHospitalVerification,
  useUpdateProviderStatus,
  useUpdateProviderVerification,
  useUpdateUserStatus,
} from '../hooks/useAdminManagement';
import type { AdminAccountStatus, AdminAmbulance, AdminAmbulanceDriver, AdminAmbulanceProvider, AdminHospital, AdminUser, AdminVerificationStatus } from '../types/adminManagement';
import { adminApi } from '../services/adminApi';

const Section = ({ children }: { children: ReactNode }) => <AdminLayout>{children}</AdminLayout>;
const ErrorBox = ({ message, retry }: { message: string; retry: () => void }) => <div className="flex items-center justify-between gap-4 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>{message}</span><Button size="sm" variant="secondary" onClick={retry} icon={<RefreshCw className="h-4 w-4" />}>Retry</Button></div>;
const Loading = () => <div className="flex items-center justify-center p-12 text-sm text-slate-500">Loading live admin data…</div>;
const Empty = ({ label }: { label: string }) => <div className="p-10 text-center text-sm text-slate-500">{label}</div>;
const Status = ({ value }: { value: string }) => <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{value}</span>;
const Pager = ({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) => <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500"><span>Page {page} of {Math.max(totalPages, 1)}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={<ChevronLeft className="h-4 w-4" />}>Previous</Button><Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)} icon={<ChevronRight className="h-4 w-4" />}>Next</Button></div></div>;
const Search = ({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) => <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />;
const Select = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) => <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none">{children}</select>;
const ConfirmAction = ({ label, onConfirm, disabled = false }: { label: string; onConfirm: () => void; disabled?: boolean }) => <Button size="sm" variant="secondary" disabled={disabled} onClick={() => { if (window.confirm(`Confirm: ${label}?`)) onConfirm(); }}>{label}</Button>;
const message = (error: unknown): string => error instanceof Error ? error.message : 'The operation failed.';

export const AdminOverviewPage = () => {
  const q = useAdminOverview();
  if (q.isLoading) return <Section><AdminPage title="Operations overview" description="Live ResQ platform metrics."><Loading /></AdminPage></Section>;
  if (q.isError || !q.data) return <Section><AdminPage title="Operations overview"><ErrorBox message={message(q.error)} retry={() => void q.refetch()} /></AdminPage></Section>;
  const d = q.data;
  const metrics = [
    { label: 'Users', value: String(d.totalUsers), detail: `${d.activeUsers} active` },
    { label: 'Hospitals', value: String(d.totalHospitals), detail: `${d.verifiedHospitals} verified` },
    { label: 'Providers', value: String(d.totalAmbulanceProviders), detail: `${d.verifiedProviders} verified` },
    { label: 'Ambulances', value: String(d.totalAmbulances), detail: 'Registered fleet' },
    { label: 'Drivers', value: String(d.totalAmbulanceDrivers), detail: `${d.verifiedDrivers} verified` },
    { label: 'Pending', value: String(d.pendingHospitals + d.pendingProviders + d.pendingDrivers), detail: 'Registrations awaiting review' },
  ];
  return <Section><AdminPage title="Operations overview" description="Live MongoDB-backed platform metrics."><MetricGrid metrics={metrics} /><div className="mt-6 grid gap-6 lg:grid-cols-3"><Panel title="Pending registrations"><div className="space-y-3 p-5 text-sm"><div className="flex justify-between"><span>Hospitals</span><b>{d.pendingHospitals}</b></div><div className="flex justify-between"><span>Providers</span><b>{d.pendingProviders}</b></div><div className="flex justify-between"><span>Drivers</span><b>{d.pendingDrivers}</b></div></div></Panel><Panel title="Account health"><div className="space-y-3 p-5 text-sm"><div className="flex justify-between"><span>Active users</span><b>{d.activeUsers}</b></div><div className="flex justify-between"><span>Suspended users</span><b>{d.suspendedUsers}</b></div></div></Panel><Panel title="Verification"><div className="space-y-3 p-5 text-sm"><div className="flex justify-between"><span>Hospitals</span><b>{d.verifiedHospitals}</b></div><div className="flex justify-between"><span>Providers</span><b>{d.verifiedProviders}</b></div><div className="flex justify-between"><span>Drivers</span><b>{d.verifiedDrivers}</b></div></div></Panel></div><div className="mt-6"><Panel title="Operational data"><div className="p-5 text-sm text-slate-600">Emergency, ambulance and driver lifecycle records are available through the live management APIs.</div></Panel></div></AdminPage></Section>;
};

export const AdminUsersPage = () => {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [role, setRole] = useState(''); const [page, setPage] = useState(1); const q = useAdminUsers({ page, limit: 20, search, status: status as AdminAccountStatus | undefined, role: role as AdminUser['role'] | undefined }); const mutation = useUpdateUserStatus();
  return <Section><AdminPage title="User oversight" description="Search, inspect and manage registered accounts."><Panel title="Users"><div className="grid gap-2 border-b border-slate-200 p-4 md:grid-cols-[1fr_auto_auto]"><Search value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name, email or phone" /><Select value={role} onChange={(v) => { setRole(v); setPage(1); }}><option value="">All roles</option><option>USER</option><option>HOSPITAL</option><option>AMBULANCE_PROVIDER</option><option>AMBULANCE_DRIVER</option><option>ADMIN</option></Select><Select value={status} onChange={(v) => { setStatus(v); setPage(1); }}><option value="">All statuses</option><option>ACTIVE</option><option>PENDING</option><option>SUSPENDED</option><option>REJECTED</option></Select></div>{q.isLoading ? <Loading /> : q.isError ? <ErrorBox message={message(q.error)} retry={() => void q.refetch()} /> : !q.data?.items.length ? <Empty label="No users match these filters." /> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="px-4 py-3">User</th><th>Role</th><th>Status</th><th>Location</th><th>Verification</th><th>Action</th></tr></thead><tbody>{q.data.items.map((u) => <tr key={u.id} className="border-b border-slate-100"><td className="px-4 py-3"><b>{u.name}</b><div className="text-xs text-slate-500">{u.email} · {u.phone}</div></td><td><Status value={u.role} /></td><td><Status value={u.accountStatus} /></td><td>{u.city ?? '—'}, {u.state ?? '—'}</td><td>{u.emailVerified && u.phoneVerified ? 'Verified' : 'Partial'}</td><td><ConfirmAction label={u.accountStatus !== 'ACTIVE' ? 'Activate' : 'Suspend'} disabled={mutation.isPending} onConfirm={() => mutation.mutate({ id: u.id, status: u.accountStatus !== 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED' })} /></td></tr>)}</tbody></table></div><Pager {...q.data.pagination} onPage={setPage} /></>}</Panel></AdminPage></Section>;
};

function ApprovalActions({ id, verification, accountStatus, verify, changeStatus }: { id: string; verification: AdminVerificationStatus; accountStatus: AdminAccountStatus; verify: (id: string, status: AdminVerificationStatus) => void; changeStatus: (id: string, status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'>) => void }) { return <div className="flex flex-wrap gap-2"><Status value={`V: ${verification}`} /><Status value={`A: ${accountStatus}`} />{verification !== 'VERIFIED' && <ConfirmAction label="Verify" onConfirm={() => verify(id, 'VERIFIED')} />}{verification !== 'REJECTED' && <ConfirmAction label="Reject" onConfirm={() => verify(id, 'REJECTED')} />}{accountStatus !== 'ACTIVE' ? <ConfirmAction label="Activate" onConfirm={() => changeStatus(id, 'ACTIVE')} /> : <ConfirmAction label="Suspend" onConfirm={() => changeStatus(id, 'SUSPENDED')} />}</div>; }

export const AdminHospitalsPage = () => {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const q = useAdminHospitals({ page, limit: 20, search }); const verification = useUpdateHospitalVerification(); const status = useUpdateHospitalStatus();
  return <Section><AdminPage title="Hospital network" description="Real registrations with separate verification and account status."><Panel title="Hospitals"><div className="p-4"><Search value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Hospital, registration number, email or phone" /></div>{q.isLoading ? <Loading /> : q.isError ? <ErrorBox message={message(q.error)} retry={() => void q.refetch()} /> : !q.data?.items.length ? <Empty label="No hospitals found." /> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="px-4 py-3">Hospital</th><th>Type</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>{q.data.items.map((h: AdminHospital) => <tr key={h.id} className="border-b border-slate-100 align-top"><td className="px-4 py-3"><b>{h.name}</b><div className="text-xs text-slate-500">{h.registrationNumber} · {h.email}</div></td><td>{h.hospitalType}</td><td>{h.city ?? '—'}, {h.state ?? '—'}</td><td><Status value={h.verificationStatus} /><div className="mt-1"><Status value={h.accountStatus} /></div></td><td><ApprovalActions id={h.id} verification={h.verificationStatus} accountStatus={h.accountStatus} verify={(id,v) => verification.mutate({ id, verificationStatus: v })} changeStatus={(id,s) => status.mutate({ id, status: s })} /></td></tr>)}</tbody></table></div><Pager {...q.data.pagination} onPage={setPage} /></>}</Panel></AdminPage></Section>;
};

export const AdminAmbulancesPage = () => {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const q = useAdminAmbulances({ page, limit: 20, search });
  return <Section><AdminPage title="Ambulance network" description="Live fleet registrations, relationships and current location data."><Panel title="Ambulances"><div className="p-4"><Search value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Registration, vehicle number or type" /></div>{q.isLoading ? <Loading /> : q.isError ? <ErrorBox message={message(q.error)} retry={() => void q.refetch()} /> : !q.data?.items.length ? <Empty label="No ambulances found." /> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="px-4 py-3">Ambulance</th><th>Provider</th><th>Driver</th><th>Status</th><th>Location</th></tr></thead><tbody>{q.data.items.map((a: AdminAmbulance) => <tr key={a.id} className="border-b border-slate-100"><td className="px-4 py-3"><b>{a.registrationNumber}</b><div className="text-xs text-slate-500">{a.vehicleNumber} · {a.ambulanceType}</div></td><td>{a.provider?.name ?? 'Unassigned'}</td><td>{a.assignedDriver?.name ?? 'Unassigned'}</td><td><Status value={a.currentStatus} /><div className="mt-1"><Status value={a.verificationStatus} /></div></td><td>{a.currentLatitude !== undefined && a.currentLongitude !== undefined ? `${a.currentLatitude}, ${a.currentLongitude}` : 'No current location'}</td></tr>)}</tbody></table></div><Pager {...q.data.pagination} onPage={setPage} /></>}</Panel></AdminPage></Section>;
};

export const AdminProvidersPage = () => { const [search,setSearch]=useState(''); const [page,setPage]=useState(1); const q=useAdminProviders({page,limit:20,search}); const v=useUpdateProviderVerification(); const s=useUpdateProviderStatus(); return <Section><AdminPage title="Ambulance providers" description="Manage provider verification, account status and fleet relationships."><Panel title="Providers"><div className="p-4"><Search value={search} onChange={(x)=>{setSearch(x);setPage(1)}} placeholder="Provider, registration, email or phone"/></div>{q.isLoading?<Loading/>:q.isError?<ErrorBox message={message(q.error)} retry={()=>void q.refetch()}/>:!q.data?.items.length?<Empty label="No providers found."/>:<><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="px-4 py-3">Provider</th><th>Location</th><th>Fleet</th><th>Status</th><th>Actions</th></tr></thead><tbody>{q.data.items.map((p:AdminAmbulanceProvider)=><tr key={p.id} className="border-b border-slate-100 align-top"><td className="px-4 py-3"><b>{p.name}</b><div className="text-xs text-slate-500">{p.registrationNumber} · {p.email}</div></td><td>{p.city??'—'}, {p.state??'—'}</td><td>{p.ambulanceCount}</td><td><Status value={p.verificationStatus}/><div className="mt-1"><Status value={p.accountStatus}/></div></td><td><ApprovalActions id={p.id} verification={p.verificationStatus} accountStatus={p.accountStatus} verify={(id,x)=>v.mutate({id,verificationStatus:x})} changeStatus={(id,x)=>s.mutate({id,status:x})}/></td></tr>)}</tbody></table></div><Pager {...q.data.pagination} onPage={setPage}/></>}</Panel></AdminPage></Section>; };

export const AdminDriversPage = () => { const [search,setSearch]=useState(''); const [page,setPage]=useState(1); const q=useAdminDrivers({page,limit:20,search}); const v=useUpdateDriverVerification(); const s=useUpdateDriverStatus(); return <Section><AdminPage title="Ambulance drivers" description="Review driver verification, registered location and fleet assignment."><Panel title="Drivers"><div className="p-4"><Search value={search} onChange={(x)=>{setSearch(x);setPage(1)}} placeholder="Name, email, phone or license"/></div>{q.isLoading?<Loading/>:q.isError?<ErrorBox message={message(q.error)} retry={()=>void q.refetch()}/>:!q.data?.items.length?<Empty label="No drivers found."/>:<><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="px-4 py-3">Driver</th><th>Provider</th><th>Ambulance</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>{q.data.items.map((d:AdminAmbulanceDriver)=><tr key={d.id} className="border-b border-slate-100 align-top"><td className="px-4 py-3"><b>{d.fullName}</b><div className="text-xs text-slate-500">{d.email} · {d.licenseNumber}</div></td><td>{d.provider?.name??'Unassigned'}</td><td>{d.assignedAmbulance?.registrationNumber??'Unassigned'}</td><td>{d.city??'—'}, {d.state??'—'}</td><td><Status value={d.licenseVerificationStatus}/><div className="mt-1"><Status value={d.accountStatus}/></div></td><td><ApprovalActions id={d.id} verification={d.licenseVerificationStatus} accountStatus={d.accountStatus} verify={(id,x)=>v.mutate({id,verificationStatus:x})} changeStatus={(id,x)=>s.mutate({id,status:x})}/></td></tr>)}</tbody></table></div><Pager {...q.data.pagination} onPage={setPage}/></>}</Panel></AdminPage></Section>; };

export const AdminEmergenciesPage = () => {
  const queryClient = useQueryClient();
  const [manualDriverIds, setManualDriverIds] = useState<Record<string, string>>({});
  const [escalationReason, setEscalationReason] = useState('No eligible driver available; operations intervention required.');
  const dispatchJobs = useQuery({ queryKey: ['admin-dispatch-jobs'], queryFn: () => adminApi.dispatchJobs({ limit: 50 }), refetchInterval: 5000 });
  const refreshDispatch = async () => { await queryClient.invalidateQueries({ queryKey: ['admin-dispatch-jobs'] }); await queryClient.invalidateQueries({ queryKey: ['admin-emergencies'] }); };
  const retryDispatch = useMutation({ mutationFn: (id: string) => adminApi.retryDispatchJob(id), onSuccess: refreshDispatch });
  const manualDispatch = useMutation({ mutationFn: ({ id, driverId }: { id: string; driverId: string }) => adminApi.manualAssignDispatchJob(id, driverId), onSuccess: refreshDispatch });
  const escalateDispatch = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.escalateDispatchJob(id, reason), onSuccess: refreshDispatch });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const q = useAdminEmergencies({ page, limit: 20, search: search || undefined, status: status || undefined });
  if (q.isLoading) return <Section><AdminPage title="Emergency monitor"><Loading /></AdminPage></Section>;
  if (q.isError || !q.data) return <Section><AdminPage title="Emergency monitor"><ErrorBox message={message(q.error)} retry={() => void q.refetch()} /></AdminPage></Section>;
  const rows = q.data.items.map((x) => ({
    id: x.requestCode,
    category: x.situationType,
    hospital: x.hospital?.name ?? '—',
    ambulance: x.ambulance?.registrationNumber ?? 'Unassigned',
    eta: x.etaMinutes !== undefined ? `${x.etaMinutes} min` : 'Unavailable',
    status: x.status,
    area: x.pickup.label ?? 'Location unavailable',
  }));
  return (
    <Section>
      <AdminPage title="Emergency monitor" description="Live MongoDB-backed emergency requests with operational relationships.">
        <Panel title="Emergency requests">
          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
            <Search value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Request code, situation or object id" />
            <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }}>
              <option value="">All statuses</option>
              <option>RECEIVED</option>
              <option>REVIEWING</option>
              <option>PREPARING</option>
              <option>AMBULANCE_COORDINATION</option>
              <option>RESOLVED</option>
              <option>CANCELLED</option>
            </Select>
            <Button size="sm" variant="secondary" onClick={() => void q.refetch()} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
          </div>
          {!q.data.items.length ? (
            <Empty label="No emergency requests match these filters." />
          ) : (
            <>
              <EmergencyTable data={rows} />
              <Pager {...q.data.pagination} onPage={setPage} />
            </>
          )}
        </Panel>
        <Panel title="Automatic ambulance dispatch" description="Persistent offer attempts, server deadlines and recovery controls.">
          {dispatchJobs.isLoading ? <Loading /> : dispatchJobs.isError ? <ErrorBox message={message(dispatchJobs.error)} retry={() => void dispatchJobs.refetch()} /> : !dispatchJobs.data?.length ? <Empty label="No dispatch jobs have been created." /> : (
            <div className="space-y-3 p-4">
              {dispatchJobs.data.map((job) => (
                <article key={job.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{job.requestCode ?? job.emergencyRequestId}</p><p className="mt-1 text-xs text-slate-500">{job.situationType ?? job.category} · Generation {job.generation} · {job.attempts.length} attempts</p></div>
                    <Status value={job.status} />
                  </div>
                  {job.deadlineAt && <p className="mt-2 text-xs text-slate-600">Current server deadline: {new Date(job.deadlineAt).toLocaleString()}</p>}
                  {job.escalationReason && <p className="mt-2 text-xs text-amber-800">{job.escalationReason}</p>}
                  {job.attempts.length > 0 && <div className="mt-3 space-y-2">{job.attempts.slice(-3).reverse().map((attempt) => <div key={attempt.attemptNumber + '-' + attempt.generation + '-' + attempt.driverId} className="rounded-lg bg-slate-50 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">Attempt {attempt.attemptNumber} · {attempt.status}</span><span>{attempt.routeSource === 'DRIVING' && attempt.etaSeconds ? Math.round(attempt.etaSeconds / 60) + ' min driving' : 'Straight-line fallback'}</span></div><p className="mt-1 text-slate-500">Driver {attempt.driverId} · {Math.round(attempt.routeDistanceMeters)} m · {attempt.reason ?? 'No additional reason'}</p></div>)}</div>}
                  {['EXHAUSTED', 'ESCALATED'].includes(job.status) && <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
                    <p className="text-xs font-semibold text-amber-900">No active offer. Choose a recovery action; hospital destination remains unchanged.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" disabled={retryDispatch.isPending} onClick={() => retryDispatch.mutate(job.id)}>Retry dispatch</Button>
                      <Button size="sm" variant="secondary" disabled={escalateDispatch.isPending || job.status !== 'EXHAUSTED'} onClick={() => escalateDispatch.mutate({id:job.id,reason:escalationReason})}>Escalate</Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input aria-label="Driver ID for manual dispatch" value={manualDriverIds[job.id] ?? ''} onChange={(event) => setManualDriverIds((old) => ({...old,[job.id]:event.target.value.trim()}))} placeholder="Verified driver's MongoDB ID" className="h-10 rounded-lg border border-slate-300 px-3 text-xs" />
                      <Button size="sm" variant="primary" disabled={manualDispatch.isPending || !/^[a-f\d]{24}$/i.test(manualDriverIds[job.id] ?? '')} onClick={() => manualDispatch.mutate({id:job.id,driverId:manualDriverIds[job.id]})}>Offer to driver</Button>
                    </div>
                    <input aria-label="Escalation reason" value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-xs" />
                  </div>}
                </article>
              ))}
            </div>
          )}
          {(retryDispatch.isError || manualDispatch.isError || escalateDispatch.isError) && <p role="alert" className="px-4 pb-4 text-sm text-rose-700">{message(retryDispatch.error || manualDispatch.error || escalateDispatch.error)}</p>}
          {(retryDispatch.isSuccess || manualDispatch.isSuccess || escalateDispatch.isSuccess) && <p role="status" className="px-4 pb-4 text-sm text-emerald-700">Dispatch action submitted successfully.</p>}
        </Panel>
      </AdminPage>
    </Section>
  );
};

const ReportDashboard = ({ analytics = false }: { analytics?: boolean }) => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  const [preset, setPreset] = useState<'TODAY' | '7D' | '30D' | '90D' | 'CUSTOM'>('30D');
  const [from, setFrom] = useState(start.toISOString().slice(0, 10));
  const [to, setTo] = useState(end.toISOString().slice(0, 10));
  const params = useMemo(() => ({
    from: from ? new Date(from + 'T00:00:00.000Z').toISOString() : undefined,
    to: to ? new Date(to + 'T23:59:59.999Z').toISOString() : undefined,
  }), [from, to]);
  const overview = useAdminReportOverview(params);
  const emergencies = useAdminEmergencyReports(params);
  const operational = useAdminAnalytics(params);
  const refresh = () => {
    void overview.refetch();
    void emergencies.refetch();
    void operational.refetch();
  };
  const apply = (p: 'TODAY' | '7D' | '30D' | '90D') => {
    const e = new Date();
    const s = new Date(e);
    s.setUTCDate(s.getUTCDate() - (p === 'TODAY' ? 0 : p === '7D' ? 6 : p === '30D' ? 29 : 89));
    setPreset(p);
    setFrom(s.toISOString().slice(0, 10));
    setTo(e.toISOString().slice(0, 10));
  };
  const exportCsv = async () => {
    try {
      const blob = await adminApi.exportReports(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resq-emergency-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(message(e));
    }
  };
  if (overview.isLoading || emergencies.isLoading || operational.isLoading) {
    return <Section><AdminPage title={analytics ? 'Analytics' : 'Reports'}><Loading /></AdminPage></Section>;
  }
  if (overview.isError || emergencies.isError || operational.isError) {
    return <Section><AdminPage title={analytics ? 'Analytics' : 'Reports'}><ErrorBox message={message(overview.error || emergencies.error || operational.error)} retry={refresh} /></AdminPage></Section>;
  }
  if (!overview.data || !emergencies.data || !operational.data) {
    return <Section><AdminPage title={analytics ? 'Analytics' : 'Reports'}><Empty label="No operational data available for this period." /></AdminPage></Section>;
  }
  const d = overview.data;
  const hospitalData = emergencies.data.hospitals.map((x) => ({ label: x.name, value: x.value }));
  return (
    <Section>
      <AdminPage
        title={analytics ? 'Analytics' : 'Reports'}
        description="Real MongoDB-backed operational reporting."
        action={
          <div className="flex gap-2 print:hidden">
            <Button size="sm" variant="secondary" onClick={() => window.print()}>Print</Button>
            <Button size="sm" variant="secondary" onClick={refresh} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            <Button size="sm" variant="primary" onClick={exportCsv} icon={<Download className="h-4 w-4" />}>Export CSV</Button>
          </div>
        }
      >
        <Panel title="Date range">
          <div className="flex flex-wrap items-center gap-2 p-4">
            {(['TODAY', '7D', '30D', '90D', 'CUSTOM'] as const).map((p) => (
              <Button key={p} size="sm" variant={preset === p ? 'primary' : 'secondary'} onClick={() => p === 'CUSTOM' ? setPreset('CUSTOM') : apply(p)}>
                {p === 'TODAY' ? 'Today' : p === '7D' ? 'Last 7 days' : p === '30D' ? 'Last 30 days' : p === '90D' ? 'Last 90 days' : 'Custom'}
              </Button>
            ))}
            {preset === 'CUSTOM' && (
              <>
                <label className="text-xs text-slate-500">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 h-9 rounded-md border border-slate-200 px-2 text-sm" /></label>
                <label className="text-xs text-slate-500">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 h-9 rounded-md border border-slate-200 px-2 text-sm" /></label>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={refresh} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            <Button size="sm" variant="primary" onClick={exportCsv} icon={<Download className="h-4 w-4" />}>Export CSV</Button>
          </div>
          <div className="px-4 pb-4 text-xs text-slate-500">Selected range: {from} to {to} (UTC). Last updated: {new Date(d.generatedAt).toLocaleString()}.</div>
        </Panel>
        <div className="mt-6">
          <MetricGrid metrics={[
            { label: 'Emergency requests', value: String(d.emergencies.totalRequests), detail: 'Selected period' },
            { label: 'Active emergencies', value: String(d.emergencies.activeRequests), detail: 'Selected period' },
            { label: 'Resolved', value: String(d.emergencies.resolved), detail: 'Selected period' },
            { label: 'Cancelled', value: String(d.emergencies.cancelled), detail: 'Selected period' },
            { label: 'Hospitals in network', value: String(d.hospitals.total), detail: `${d.hospitals.verified} verified` },
            { label: 'Ambulances in fleet', value: String(d.ambulances.total), detail: `${d.ambulances.available} available now` },
            { label: 'Drivers', value: String(d.drivers.total), detail: `${d.drivers.online} online` },
          ]} />
        </div>
        {d.emergencies.totalRequests === 0 ? (
          <div className="mt-6"><Panel title="Emergency analytics"><Empty label="No emergency requests in selected period." /></Panel></div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <TrendChart title="Daily emergency volume" description="Requests grouped by UTC date." data={emergencies.data.trend.map((x) => ({ label: x._id, value: x.value }))} />
            <CategoryChart title="Emergency status distribution" data={emergencies.data.status.map((x) => ({ label: x._id, value: x.value }))} />
            <CategoryChart title="Situation distribution" data={emergencies.data.situations.map((x) => ({ label: x._id, value: x.value }))} />
            <CategoryChart title="Hospital distribution" data={hospitalData} />
            <Panel title="Ambulance operations">
              <div className="grid grid-cols-2 gap-3 p-5 text-sm">
                {operational.data.ambulanceStatus.map((x) => (
                  <div key={x.label} className="flex justify-between"><span>{x.label}</span><b>{x.value}</b></div>
                ))}
              </div>
            </Panel>
            {analytics && (
              <Panel title="Resolution and response">
                <div className="space-y-3 p-5 text-sm">
                  <div className="flex justify-between"><span>Resolution ratio</span><b>{operational.data.resolutionRatio === null ? 'Unavailable' : `${(operational.data.resolutionRatio * 100).toFixed(1)}%`}</b></div>
                  <div className="flex justify-between"><span>Average RECEIVED → REVIEWING</span><b>{operational.data.responseToReview.averageMinutes === null ? 'Unavailable' : `${operational.data.responseToReview.averageMinutes.toFixed(1)} min`}</b></div>
                  <div className="flex justify-between"><span>Samples</span><b>{operational.data.responseToReview.samples}</b></div>
                </div>
              </Panel>
            )}
          </div>
        )}
      </AdminPage>
    </Section>
  );
};

export const AdminReportsPage = () => <ReportDashboard />;
export const AdminAnalyticsPage = () => <ReportDashboard analytics />;
export const AdminSettingsPage = () => <Section><AdminPage title="Settings" description="Operational settings are not part of this management API scope."><Panel title="Status"><div className="p-5 text-sm text-slate-600">Admin authentication and authorization remain enforced by the backend. No settings are persisted by this feature.</div></Panel></AdminPage></Section>;
export default AdminOverviewPage;
