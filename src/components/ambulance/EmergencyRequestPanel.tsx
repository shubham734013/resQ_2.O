import { AlertTriangle, MapPin } from 'lucide-react';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import type { EmergencyRequest } from '../../types/ambulance';

export const EmergencyRequestPanel = ({ request, onAccept, onDecline }: { request: EmergencyRequest; onAccept: () => void; onDecline: () => void }) => (
  <div className="flex flex-1 flex-col bg-slate-50">
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 pb-32 sm:px-6 sm:py-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Request</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Emergency Request</h1></div><StatusBadge variant="emergency" label="Emergency" size="md" /></div>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-rose-50 text-rose-700"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-xs text-slate-500">Request ID</p><p className="font-semibold">{request.id}</p></div></div><dl className="mt-5 space-y-4 text-sm">
        <div className="flex justify-between gap-4 border-t border-slate-100 pt-4"><dt className="text-slate-500">Category</dt><dd className="font-semibold">{request.category}</dd></div>
        <div className="flex justify-between gap-4 border-t border-slate-100 pt-4"><dt className="text-slate-500">Pickup</dt><dd className="max-w-[60%] text-right font-semibold">{request.pickupLocation.label}</dd></div>
        <div className="flex justify-between gap-4 border-t border-slate-100 pt-4"><dt className="text-slate-500">Distance</dt><dd className="font-semibold">{request.pickupLocation.distance}</dd></div>
        <div className="flex justify-between gap-4 border-t border-slate-100 pt-4"><dt className="text-slate-500">Estimated pickup</dt><dd className="font-semibold">{request.pickupLocation.estimatedPickupTime}</dd></div>
      </dl></div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" /><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Destination hospital</p><p className="mt-1 font-semibold">{request.hospitalDestination.name}</p></div></div></div>
    </div>
    <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-sm sm:static sm:mx-auto sm:w-full sm:max-w-2xl sm:border-t-0 sm:bg-transparent sm:p-0"><div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]"><Button type="button" variant="emergency" size="lg" fullWidth onClick={onAccept} className="min-h-14 text-base font-semibold">Accept Request</Button><Button type="button" variant="secondary" size="lg" fullWidth onClick={onDecline} className="min-h-14">Decline</Button></div></div>
  </div>
);
