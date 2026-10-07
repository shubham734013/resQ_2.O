import { useMemo, useState, type ReactNode } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { AdminPage, MetricGrid, Panel } from '../components/admin/AdminPrimitives';
import { TrendChart, CategoryChart } from '../components/admin/AdminCharts';
import { Button } from '../components/common/Button';
import {
  useAdminOverview, useAdminReportOverview, useAdminEmergencyReports, useAdminAnalytics
} from '../hooks/useAdminManagement';
import type { ReportOverview } from '../types/adminReports';
import { adminApi } from '../services/adminApi';

const Section = ({ children }: { children: ReactNode }) => <AdminLayout>{children}</AdminLayout>;
const Loading = () => <div className="flex items-center justify-center p-12 text-sm text-slate-500" role="status">Loading live admin data…</div>;
const ErrorBox = ({ message, retry }: { message: string; retry: () => void }) => <div className="flex items-center justify-between gap-4 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert"><span>{message}</span><Button size="sm" variant="secondary" onClick={retry} icon={<RefreshCw className="h-4 w-4" />}>Retry</Button></div>;
const Empty = ({ label }: { label: string }) => <div className="p-10 text-center text-sm text-slate-500">{label}</div>;
const Status = ({ value }: { value: string }) => <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{value}</span>;
const Pager = ({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) => <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500"><span>Page {page} of {Math.max(totalPages,1)}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page<=1} onClick={()=>onPage(page-1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page>=totalPages} onClick={()=>onPage(page+1)}>Next</Button></div></div>;
const Search = ({ value, onChange, placeholder='Search…' }: { value:string; onChange:(v:string)=>void; placeholder?:string }) => <input aria-label={placeholder} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />;
const Select = ({ value, onChange, children }: { value:string; onChange:(v:string)=>void; children:ReactNode }) => <select aria-label="Filter" value={value} onChange={e=>onChange(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none">{children}</select>;
const ConfirmAction = ({ label,onConfirm,disabled=false }: { label:string; onConfirm:()=>void; disabled?:boolean }) => <Button size="sm" variant="secondary" disabled={disabled} onClick={()=>{if(window.confirm(`Confirm: ${label}?`))onConfirm();}}>{label}</Button>;
const message = (error: unknown): string => error instanceof Error ? error.message : 'The operation failed.';

const DateRange = ({from,to,setFrom,setTo,onRefresh,onExport}:{from:string;to:string;setFrom:(v:string)=>void;setTo:(v:string)=>void;onRefresh:()=>void;onExport:()=>void}) =>
  <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 p-4">
    <label className="text-xs text-slate-500">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 h-10 rounded-md border border-slate-200 px-3 text-sm"/></label>
    <label className="text-xs text-slate-500">To<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 h-10 rounded-md border border-slate-200 px-3 text-sm"/></label>
    <Button size="sm" variant="secondary" onClick={onRefresh} icon={<RefreshCw className="h-4 w-4"/>}>Refresh</Button>
    <Button size="sm" variant="primary" onClick={onExport} icon={<Download className="h-4 w-4"/>}>Export CSV</Button>
  </div>;

export const AdminOverviewPage = () => {
  const q=useAdminOverview();
  if(q.isLoading)return <Section><AdminPage title="Operations overview" description="Live ResQ platform metrics."><Loading/></AdminPage></Section>;
  if(q.isError||!q.data)return <Section><AdminPage title="Operations overview"><ErrorBox message={message(q.error)} retry={()=>void q.refetch()}/></AdminPage></Section>;
  const d=q.data;
  return <Section><AdminPage title="Operations overview" description="Live MongoDB-backed platform metrics."><MetricGrid metrics={[
    {label:'Users',value:String(d.totalUsers),detail:`${d.activeUsers} active`},{label:'Hospitals',value:String(d.totalHospitals),detail:`${d.verifiedHospitals} verified`},{label:'Providers',value:String(d.totalAmbulanceProviders),detail:`${d.verifiedProviders} verified`},{label:'Ambulances',value:String(d.totalAmbulances),detail:'Registered fleet'},{label:'Drivers',value:String(d.totalAmbulanceDrivers),detail:`${d.verifiedDrivers} verified`},{label:'Pending',value:String(d.pendingHospitals+d.pendingProviders+d.pendingDrivers),detail:'Registrations awaiting review'}
  ]}/></AdminPage></Section>;
};

export const AdminUsersPage = () => <Section><AdminPage title="User oversight"><Panel title="Users"><Empty label="Use the dedicated Users management page." /></Panel></AdminPage></Section>;
export const AdminHospitalsPage = () => <Section><AdminPage title="Hospital network"><Panel title="Hospitals"><Empty label="Use the dedicated Hospitals management page." /></Panel></AdminPage></Section>;
export const AdminAmbulancesPage = () => <Section><SectionPlaceholder label="Use the dedicated Ambulances management page." /></Section>;
export const AdminProvidersPage = () => <Section><SectionPlaceholder label="Use the dedicated Providers management page." /></Section>;
export const AdminDriversPage = () => <Section><SectionPlaceholder label="Use the dedicated Drivers management page." /></Section>;
const SectionPlaceholder=({label}:{label:string})=><Panel title="Live management"><Empty label={label}/></Panel>;

export const AdminEmergenciesPage = () => <Section><AdminPage title="Emergency monitor" description="Emergency operational records from MongoDB."><Panel title="Emergency requests"><Empty label="Use hospital emergency operations for detailed coordination." /></Panel></AdminPage></Section>;

const reportRangeDefaults = () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
};

const reportRangeParams = (from: string, to: string) => ({
  from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
  to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
});

type ReportPreset = 'TODAY' | '7D' | '30D' | '90D' | 'CUSTOM';

const presetRange = (preset: Exclude<ReportPreset, 'CUSTOM'>) => {
  const end = new Date();
  const start = new Date(end);
  const days = preset === 'TODAY' ? 0 : preset === '7D' ? 6 : preset === '30D' ? 29 : 89;
  start.setUTCDate(start.getUTCDate() - days);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
};

const ReportDashboard = ({ analytics = false }: { analytics?: boolean }) => {
  const defaults = reportRangeDefaults();
  const [preset, setPreset] = useState<ReportPreset>('30D');
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const params = useMemo(() => reportRangeParams(from, to), [from, to]);
  const overview = useAdminReportOverview(params);
  const emergencies = useAdminEmergencyReports(params);
  const operational = useAdminAnalytics(params);

  const refresh = () => {
    void overview.refetch();
    void emergencies.refetch();
    void operational.refetch();
  };

  const applyPreset = (next: Exclude<ReportPreset, 'CUSTOM'>) => {
    const range = presetRange(next);
    setPreset(next);
    setFrom(range.from);
    setTo(range.to);
  };

  const exportCsv = async () => {
    try {
      const blob = await adminApi.exportReports(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'resq-emergency-report.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(message(error));
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

  const data = overview.data;
  const statusData = emergencies.data.status.map((item) => ({ label: item._id, value: item.value }));
  const situationData = emergencies.data.situations.map((item) => ({ label: item._id, value: item.value }));
  const hospitalData = emergencies.data.hospitals.map((item) => ({ label: item.name, value: item.value }));

  return <Section><AdminPage title={analytics ? 'Analytics' : 'Reports'} description="Real MongoDB-backed operational reporting.">
    <Panel title="Date range">
      <div className="flex flex-wrap items-center gap-2 p-4">
        {(['TODAY', '7D', '30D', '90D', 'CUSTOM'] as ReportPreset[]).map((item) =>
          <Button key={item} size="sm" variant={preset === item ? 'primary' : 'secondary'} onClick={() => item === 'CUSTOM' ? setPreset('CUSTOM') : applyPreset(item)}>
            {item === 'TODAY' ? 'Today' : item === '7D' ? 'Last 7 days' : item === '30D' ? 'Last 30 days' : item === '90D' ? 'Last 90 days' : 'Custom'}
          </Button>
        )}
        {preset === 'CUSTOM' && <div className="flex flex-wrap gap-2">
          <label className="text-xs text-slate-500">From<input aria-label="Report start date" type="date" value={from} onChange={event => setFrom(event.target.value)} className="ml-1 h-9 rounded-md border border-slate-200 px-2 text-sm" /></label>
          <label className="text-xs text-slate-500">To<input aria-label="Report end date" type="date" value={to} onChange={event => setTo(event.target.value)} className="ml-1 h-9 rounded-md border border-slate-200 px-2 text-sm" /></label>
        </div>}
        <Button size="sm" variant="secondary" onClick={refresh} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
        <Button size="sm" variant="primary" onClick={exportCsv} icon={<Download className="h-4 w-4" />}>Export CSV</Button>
      </div>
      <div className="px-4 pb-4 text-xs text-slate-500">Selected range: {from} to {to} (UTC).</div>
    </Panel>

    <div className="mt-6"><MetricGrid metrics={[
      { label: 'Emergency requests', value: String(data.emergencies.totalRequests), detail: 'Selected period' },
      { label: 'Active emergencies', value: String(data.emergencies.activeRequests), detail: 'Selected period' },
      { label: 'Resolved', value: String(data.emergencies.resolved), detail: 'Selected period' },
      { label: 'Cancelled', value: String(data.emergencies.cancelled), detail: 'Selected period' },
      { label: 'Hospitals in network', value: String(data.hospitals.total), detail: `${data.hospitals.verified} verified` },
      { label: 'Ambulances in fleet', value: String(data.ambulances.total), detail: `${data.ambulances.available} available now` },
    ]} /></div>

    {data.emergencies.totalRequests === 0
      ? <div className="mt-6"><Panel title="Emergency analytics"><Empty label="No emergency requests in selected period." /></Panel></div>
      : <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TrendChart title="Daily emergency volume" description="Requests grouped by UTC date." data={emergencies.data.trend.map(item => ({ label: item._id, value: item.value }))} />
        <CategoryChart title="Emergency status distribution" description="Recorded requests by workflow status." data={statusData} />
        <CategoryChart title="Situation distribution" description="Recorded requests by situation type." data={situationData} />
        <CategoryChart title="Hospital distribution" description="Requests grouped by real hospital names." data={hospitalData} />
        <Panel title="Ambulance operations" description="Current fleet state; historical status is not stored."><div className="grid grid-cols-2 gap-3 p-5 text-sm">{operational.data.ambulanceStatus.length ? operational.data.ambulanceStatus.map(item => <div key={item.label} className="flex justify-between"><span>{item.label}</span><b>{item.value}</b></div>) : <Empty label="No ambulance records available." />}</div></Panel>
        {analytics && <Panel title="Resolution and response" description="Response-to-review is shown only where status-history timestamps exist."><div className="space-y-3 p-5 text-sm">
          <div className="flex justify-between"><span>Resolution ratio</span><b>{operational.data.resolutionRatio === null ? 'Unavailable' : `${(operational.data.resolutionRatio * 100).toFixed(1)}%`}</b></div>
          <div className="flex justify-between"><span>Average RECEIVED → REVIEWING</span><b>{operational.data.responseToReview.averageMinutes === null ? 'Unavailable' : `${operational.data.responseToReview.averageMinutes.toFixed(1)} min`}</b></div>
          <div className="flex justify-between"><span>Timestamp samples</span><b>{operational.data.responseToReview.samples}</b></div>
        </div></Panel>}
      </div>}

    <div className="mt-6"><Panel title="Hospital request distribution" description="Selected reporting period."><div className="divide-y divide-slate-100">{hospitalData.length ? hospitalData.slice(0, 10).map(item => <div key={item.label} className="flex justify-between px-5 py-3 text-sm"><span>{item.label}</span><b>{item.value}</b></div>) : <Empty label="No hospital requests in selected period." />}</div></Panel></div>
  </AdminPage></Section>;
};

export const AdminReportsPage = () => <ReportDashboard />;
export const AdminAnalyticsPage = () => <ReportDashboard analytics />;

export const AdminSettingsPage = () => <Section><AdminPage title="Settings"><Panel title="Status"><div className="p-5 text-sm text-slate-600">Admin authentication and authorization remain enforced.</div></Panel></AdminPage></Section>;
export default AdminOverviewPage;
