import { useMemo, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { AdminPage, MetricGrid, Panel } from '../components/admin/AdminPrimitives';
import { TrendChart, CategoryChart } from '../components/admin/AdminCharts';
import { Button } from '../components/common/Button';
import {
  useAdminOverview, useAdminUsers, useAdminHospitals, useAdminProviders, useAdminAmbulances, useAdminDrivers,
  useUpdateUserStatus, useUpdateHospitalVerification, useUpdateHospitalStatus, useUpdateProviderVerification, useUpdateProviderStatus,
  useUpdateDriverVerification, useUpdateDriverStatus, useAdminReportOverview, useAdminEmergencyReports, useAdminAnalytics
} from '../hooks/useAdminManagement';
import type { AdminAccountStatus, AdminAmbulance, AdminAmbulanceDriver, AdminAmbulanceProvider, AdminHospital, AdminUser, AdminVerificationStatus } from '../types/adminManagement';
import type { ReportOverview } from '../types/adminReports';
import { adminApi } from '../services/adminApi';
import { EmergencyTable, ReportTable } from '../components/admin/AdminTables';

const Section = ({ children }: { children: React.ReactNode }) => <AdminLayout>{children}</AdminLayout>;
const Loading = () => <div className="flex items-center justify-center p-12 text-sm text-slate-500" role="status">Loading live admin data…</div>;
const ErrorBox = ({ message, retry }: { message: string; retry: () => void }) => <div className="flex items-center justify-between gap-4 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert"><span>{message}</span><Button size="sm" variant="secondary" onClick={retry} icon={<RefreshCw className="h-4 w-4" />}>Retry</Button></div>;
const Empty = ({ label }: { label: string }) => <div className="p-10 text-center text-sm text-slate-500">{label}</div>;
const Status = ({ value }: { value: string }) => <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{value}</span>;
const Pager = ({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) => <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500"><span>Page {page} of {Math.max(totalPages,1)}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page<=1} onClick={()=>onPage(page-1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page>=totalPages} onClick={()=>onPage(page+1)}>Next</Button></div></div>;
const Search = ({ value, onChange, placeholder='Search…' }: { value:string; onChange:(v:string)=>void; placeholder?:string }) => <input aria-label={placeholder} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />;
const Select = ({ value, onChange, children }: { value:string; onChange:(v:string)=>void; children:React.ReactNode }) => <select aria-label="Filter" value={value} onChange={e=>onChange(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none">{children}</select>;
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

const rangeDefaults=()=>{
  const end=new Date(); end.setUTCDate(end.getUTCDate()+1);
  const start=new Date(end); start.setUTCDate(start.getUTCDate()-30);
  return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};
};
const rangeParams=(from:string,to:string)=>({from:from?new Date(`${from}T00:00:00.000Z`).toISOString():undefined,to:to?new Date(`${to}T23:59:59.999Z`).toISOString():undefined});

const ReportDashboard=({analytics=false}:{analytics?:boolean})=>{
  const d=rangeDefaults(); const [from,setFrom]=useState(d.from); const [to,setTo]=useState(d.to);
  const params=useMemo(()=>rangeParams(from,to),[from,to]);
  const overview=useAdminReportOverview(params); const emergencies=useAdminEmergencyReports(params); const ops=useAdminAnalytics(params);
  const refresh=()=>{void overview.refetch();void emergencies.refetch();void ops.refetch();};
  const exportCsv=async()=>{try{const blob=await adminApi.exportReports(params);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='resq-emergency-report.csv';a.click();URL.revokeObjectURL(url);}catch(err){window.alert(message(err));}};
  const data:ReportOverview|undefined=overview.data;
  if(overview.isLoading||emergencies.isLoading||ops.isLoading)return <Section><AdminPage title={analytics?'Analytics':'Reports'}><Loading/></AdminPage></Section>;
  if(overview.isError||emergencies.isError||ops.isError)return <Section><AdminPage title={analytics?'Analytics':'Reports'}><ErrorBox message={message(overview.error||emergencies.error||ops.error)} retry={refresh}/></AdminPage></Section>;
  if(!data||!emergencies.data||!ops.data)return <Section><AdminPage title={analytics?'Analytics':'Reports'}><Empty label="No operational data available for this period." /></AdminPage></Section>;
  const statusData=emergencies.data.status.map(x=>({label:x._id,value:x.value}));
  const situationData=emergencies.data.situations.map(x=>({label:x._id,value:x.value}));
  const hospitalData=emergencies.data.hospitals.map(x=>({label:x.name,value:x.value}));
  return <Section><AdminPage title={analytics?'Analytics':'Reports'} description="Real MongoDB-backed operational reporting.">
    <Panel title="Reporting range"><DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRefresh={refresh} onExport={exportCsv}/></Panel>
    <div className="mt-6"><MetricGrid metrics={[
      {label:'Emergency requests',value:String(data.emergencies.totalRequests),detail:'Selected period'},
      {label:'Active emergencies',value:String(data.emergencies.activeRequests),detail:'Received through ambulance coordination'},
      {label:'Resolved',value:String(data.emergencies.resolved),detail:'Selected period'},
      {label:'Cancelled',value:String(data.emergencies.cancelled),detail:'Selected period'},
      {label:'Hospitals',value:String(data.hospitals.total),detail:`${data.hospitals.verified} verified`},
      {label:'Ambulances',value:String(data.ambulances.total),detail:`${data.ambulances.available} available`},
    ]}/></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <TrendChart title="Daily emergency volume" description="Requests grouped by UTC date." data={emergencies.data.trend.map(x=>({label:x._id,value:x.value}))}/>
      <CategoryChart data={statusData}/>
      <CategoryChart data={situationData}/>
      <CategoryChart data={hospitalData}/>
      {!analytics && <Panel title="Ambulance operations" description="Current fleet status derived from ambulance records."><div className="grid grid-cols-2 gap-3 p-5 text-sm">{ops.data.ambulanceStatus.map(x=><div key={x.label} className="flex justify-between"><span>{x.label}</span><b>{x.value}</b></div>)}</div></Panel>}
      {analytics && <Panel title="Resolution / response" description="Response-to-review is shown only where status-history timestamps exist."><div className="space-y-3 p-5 text-sm"><div className="flex justify-between"><span>Resolution ratio</span><b>{ops.data.resolutionRatio===null?'Unavailable':`${(ops.data.resolutionRatio*100).toFixed(1)}%`}</b></div><div className="flex justify-between"><span>Average RECEIVED → REVIEWING</span><b>{ops.data.responseToReview.averageMinutes===null?'Unavailable':`${ops.data.responseToReview.averageMinutes.toFixed(1)} min`}</b></div><div className="flex justify-between"><span>Timestamp samples</span><b>{ops.data.responseToReview.samples}</b></div></div></Panel>}
    </div>
    <div className="mt-6"><Panel title="Top hospitals" description="Emergency requests grouped by real hospital records."><div className="divide-y divide-slate-100">{hospitalData.length?hospitalData.slice(0,10).map(x=><div key={x.label} className="flex justify-between px-5 py-3 text-sm"><span>{x.label}</span><b>{x.value}</b></div>):<Empty label="No hospital requests in selected period."/>}</div></Panel></div>
    <p className="mt-4 text-xs text-slate-500">Selected range: {from} to {to}. Metrics are derived from live backend data; unavailable timestamp metrics are not estimated.</p>
  </AdminPage></Section>;
};

export const AdminReportsPage = () => <ReportDashboard />;
export const AdminAnalyticsPage = () => <ReportDashboard analytics />;
export const AdminSettingsPage = () => <Section><AdminPage title="Settings"><Panel title="Status"><div className="p-5 text-sm text-slate-600">Admin authentication and authorization remain enforced.</div></Panel></AdminPage></Section>;
export default AdminOverviewPage;
