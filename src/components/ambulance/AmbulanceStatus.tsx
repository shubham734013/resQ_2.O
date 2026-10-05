import { Circle } from 'lucide-react';
import type { AmbulanceAvailability } from '../../types/ambulance';
import { StatusBadge } from '../common/StatusBadge';

export const AmbulanceStatus = ({ status }: { status: AmbulanceAvailability }) => {
  if (status === 'available') return <StatusBadge variant="open" label="Online · Available" size="md" />;
  if (status === 'busy') return <StatusBadge variant="urgent" label="Online · On Trip" size="md" icon={false} />;
  return <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"><Circle className="h-2.5 w-2.5 fill-slate-400 text-slate-400" />Offline</span>;
};
