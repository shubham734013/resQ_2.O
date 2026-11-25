import { type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { AdminPage, Panel } from '../components/admin/AdminPrimitives';
import { Button } from '../components/common/Button';
import {
  useAdminAmbulance,
  useAdminDriver,
  useAdminHospital,
  useAdminProvider,
  useAdminUser,
} from '../hooks/useAdminManagement';
import type {
  AdminAmbulance,
  AdminAmbulanceDriver,
  AdminAmbulanceProvider,
  AdminHospital,
  AdminUser,
} from '../types/adminManagement';

const Loading = () => <div className="p-10 text-center text-sm text-slate-500">Loading details…</div>;

const ErrorState = ({ retry }: { retry: () => void }) => (
  <div className="flex items-center justify-between gap-4 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
    <span>Could not load these details.</span>
    <Button size="sm" variant="secondary" onClick={retry} icon={<RefreshCw className="h-4 w-4" />}>Try again</Button>
  </div>
);

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-sm text-slate-800">{value ?? '—'}</dd>
  </div>
);

const DetailGrid = ({ children }: { children: ReactNode }) => (
  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
);

const Header = ({ title, back }: { title: string; back: string }) => (
  <div className="mb-5 flex items-center gap-3">
    <Link to={back} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Back to list">
      <ArrowLeft className="h-4 w-4" />
    </Link>
    <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
  </div>
);

const Shell = ({ children, title, back }: { children: ReactNode; title: string; back: string }) => (
  <div className="w-full">
    <AdminPage title={title} description="Account and service details.">
      <Header title={title} back={back} />
      {children}
    </AdminPage>
  </div>
);

export const AdminUserDetailPage = () => {
  const { id = '' } = useParams();
  const q = useAdminUser(id);
  if (q.isLoading) return <Shell title="User details" back="/admin/users"><Loading /></Shell>;
  if (q.isError || !q.data) return <Shell title="User details" back="/admin/users"><ErrorState retry={() => void q.refetch()} /></Shell>;
  const u: AdminUser = q.data;
  return <Shell title={u.name} back="/admin/users"><Panel title="Account"><DetailGrid>
    <Field label="Name" value={u.name} /><Field label="Email" value={u.email} /><Field label="Phone" value={u.phone} />
    <Field label="Role" value={u.role.replaceAll('_', ' ').toLowerCase()} /><Field label="Account status" value={u.accountStatus.replaceAll('_', ' ').toLowerCase()} />
    <Field label="Email checked" value={u.emailVerified ? 'Yes' : 'No'} /><Field label="Phone checked" value={u.phoneVerified ? 'Yes' : 'No'} />
    <Field label="Address" value={u.address} /><Field label="City" value={u.city} /><Field label="State" value={u.state} />
    <Field label="Country" value={u.country} /><Field label="Map location" value={u.latitude !== undefined && u.longitude !== undefined ? `${u.latitude}, ${u.longitude}` : 'Not shared'} />
    <Field label="Created" value={new Date(u.createdAt).toLocaleString()} /><Field label="Updated" value={new Date(u.updatedAt).toLocaleString()} />
  </DetailGrid></Panel></Shell>;
};

export const AdminHospitalDetailPage = () => {
  const { id = '' } = useParams();
  const q = useAdminHospital(id);
  if (q.isLoading) return <Shell title="Hospital details" back="/admin/hospitals"><Loading /></Shell>;
  if (q.isError || !q.data) return <Shell title="Hospital details" back="/admin/hospitals"><ErrorState retry={() => void q.refetch()} /></Shell>;
  const h: AdminHospital = q.data;
  return <Shell title={h.name} back="/admin/hospitals"><div className="grid gap-6 lg:grid-cols-2"><Panel title="Hospital"><DetailGrid>
    <Field label="Name" value={h.name} /><Field label="Registration" value={h.registrationNumber} /><Field label="Email" value={h.email} />
    <Field label="Phone" value={h.phone} /><Field label="Type" value={h.hospitalType} /><Field label="Emergency care" value={h.emergencyAvailability.replaceAll('_', ' ').toLowerCase()} />
    <Field label="Check" value={h.verificationStatus.replaceAll('_', ' ').toLowerCase()} /><Field label="Account status" value={h.accountStatus.replaceAll('_', ' ').toLowerCase()} /><Field label="Address" value={h.address} />
    <Field label="City" value={h.city} /><Field label="State" value={h.state} /><Field label="Country" value={h.country} />
    <Field label="Map location" value={h.latitude !== undefined && h.longitude !== undefined ? `${h.latitude}, ${h.longitude}` : 'Not shared'} />
    <Field label="Created" value={new Date(h.createdAt).toLocaleString()} /><Field label="Updated" value={new Date(h.updatedAt).toLocaleString()} />
  </DetailGrid></Panel><Panel title="Services and resources"><DetailGrid>
    <Field label="Services" value={h.services.length ? h.services.join(', ') : 'None listed'} />
    <Field label="Capabilities" value={h.capabilities.length ? h.capabilities.join(', ') : 'None listed'} />
    <Field label="Resource summary" value={Object.keys(h.resourceSummary).length ? Object.entries(h.resourceSummary).map(([k,v]) => `${k}: ${v}`).join(' · ') : 'No resources listed'} />
  </DetailGrid></Panel></div></Shell>;
};

export const AdminProviderDetailPage = () => {
  const { id = '' } = useParams();
  const q = useAdminProvider(id);
  if (q.isLoading) return <Shell title="Provider details" back="/admin/providers"><Loading /></Shell>;
  if (q.isError || !q.data) return <Shell title="Provider details" back="/admin/providers"><ErrorState retry={() => void q.refetch()} /></Shell>;
  const p: AdminAmbulanceProvider = q.data;
  return <Shell title={p.name} back="/admin/providers"><Panel title="Provider"><DetailGrid>
    <Field label="Name" value={p.name} /><Field label="Registration" value={p.registrationNumber} /><Field label="Email" value={p.email} />
    <Field label="Phone" value={p.phone} /><Field label="Service type" value={p.serviceType} /><Field label="Ambulances" value={p.ambulanceCount} />
    <Field label="Check" value={p.verificationStatus.replaceAll('_', ' ').toLowerCase()} /><Field label="Account status" value={p.accountStatus.replaceAll('_', ' ').toLowerCase()} /><Field label="Address" value={p.address} />
    <Field label="City" value={p.city} /><Field label="State" value={p.state} /><Field label="Country" value={p.country} />
    <Field label="Map location" value={p.latitude !== undefined && p.longitude !== undefined ? `${p.latitude}, ${p.longitude}` : 'Not shared'} />
    <Field label="Created" value={new Date(p.createdAt).toLocaleString()} /><Field label="Updated" value={new Date(p.updatedAt).toLocaleString()} />
  </DetailGrid></Panel></Shell>;
};

export const AdminAmbulanceDetailPage = () => {
  const { id = '' } = useParams();
  const q = useAdminAmbulance(id);
  if (q.isLoading) return <Shell title="Ambulance details" back="/admin/ambulances"><Loading /></Shell>;
  if (q.isError || !q.data) return <Shell title="Ambulance details" back="/admin/ambulances"><ErrorState retry={() => void q.refetch()} /></Shell>;
  const a: AdminAmbulance = q.data;
  return <Shell title={a.registrationNumber} back="/admin/ambulances"><Panel title="Ambulance"><DetailGrid>
    <Field label="Registration" value={a.registrationNumber} /><Field label="Vehicle" value={a.vehicleNumber} /><Field label="Type" value={a.ambulanceType} />
    <Field label="Status" value={a.currentStatus.replaceAll('_', ' ').toLowerCase()} /><Field label="Check" value={a.verificationStatus.replaceAll('_', ' ').toLowerCase()} /><Field label="Account status" value={a.accountStatus.replaceAll('_', ' ').toLowerCase()} />
    <Field label="Company" value={a.provider?.name ?? 'Not assigned'} /><Field label="Driver" value={a.assignedDriver?.name ?? 'Not assigned'} />
    <Field label="Care types" value={a.capabilities.length ? a.capabilities.join(', ') : 'None listed'} /><Field label="Service area" value={a.serviceArea} />
    <Field label="Current location" value={a.currentLatitude !== undefined && a.currentLongitude !== undefined ? `${a.currentLatitude}, ${a.currentLongitude}` : 'Not shared'} />
    <Field label="Created" value={new Date(a.createdAt).toLocaleString()} /><Field label="Updated" value={new Date(a.updatedAt).toLocaleString()} />
  </DetailGrid></Panel></Shell>;
};

export const AdminDriverDetailPage = () => {
  const { id = '' } = useParams();
  const q = useAdminDriver(id);
  if (q.isLoading) return <Shell title="Driver details" back="/admin/drivers"><Loading /></Shell>;
  if (q.isError || !q.data) return <Shell title="Driver details" back="/admin/drivers"><ErrorState retry={() => void q.refetch()} /></Shell>;
  const d: AdminAmbulanceDriver = q.data;
  return <Shell title={d.fullName} back="/admin/drivers"><Panel title="Driver"><DetailGrid>
    <Field label="Name" value={d.fullName} /><Field label="Email" value={d.email} /><Field label="Phone" value={d.phone} />
    <Field label="License" value={d.licenseNumber} /><Field label="License check" value={d.licenseVerificationStatus.replaceAll('_', ' ').toLowerCase()} />
    <Field label="Work status" value={d.availabilityStatus.replaceAll('_', ' ').toLowerCase()} /><Field label="Account status" value={d.accountStatus.replaceAll('_', ' ').toLowerCase()} />
    <Field label="Company" value={d.provider?.name ?? 'Not assigned'} /><Field label="Ambulance" value={d.assignedAmbulance?.registrationNumber ?? 'Not assigned'} />
    <Field label="Address" value={d.address} /><Field label="City" value={d.city} /><Field label="State" value={d.state} /><Field label="Country" value={d.country} />
    <Field label="Registered location" value={d.registeredLatitude !== undefined && d.registeredLongitude !== undefined ? `${d.registeredLatitude}, ${d.registeredLongitude}` : 'Not shared'} />
    <Field label="Created" value={new Date(d.createdAt).toLocaleString()} /><Field label="Updated" value={new Date(d.updatedAt).toLocaleString()} />
  </DetailGrid></Panel></Shell>;
};
