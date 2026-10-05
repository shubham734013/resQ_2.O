import {
  CheckCircle2,
  Heart,
  Brain,
  Shield,
  Ambulance,
  Activity,
  Layers,
} from 'lucide-react';
import type { Facility } from '../../types/facility';

export interface FacilityCapabilityListProps {
  facility: Facility;
  className?: string;
}

// Map capability names to appropriate icon helpers
function getCapabilityIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('cardiac') || lower.includes('cardiology') || lower.includes('stemi')) {
    return <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('stroke') || lower.includes('neurolog')) {
    return <Brain className="w-3.5 h-3.5 text-indigo-500 shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('trauma')) {
    return <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('ambulance') || lower.includes('helipad')) {
    return <Ambulance className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('icu') || lower.includes('emergency')) {
    return <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />;
  }
  return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />;
}

export const FacilityCapabilityList = ({
  facility,
  className = '',
}: FacilityCapabilityListProps) => {
  const capabilities = facility.capabilities ?? [];
  const departments = facility.departments ?? [];

  return (
    <div className={`bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-4 ${className}`}>
      {/* Clinical Departments Section */}
      {departments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Layers className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Active Departments</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {departments.map((dept) => (
              <div
                key={dept}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 font-medium text-slate-800"
              >
                {getCapabilityIcon(dept)}
                <span className="truncate">{dept}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verified Clinical Capabilities */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Activity className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>Verified Clinical Capabilities</span>
        </div>

        <ul className="space-y-1.5">
          {capabilities.map((cap) => (
            <li
              key={cap}
              className="flex items-center gap-2.5 text-xs text-slate-700 bg-slate-50/70 border border-slate-100 rounded-lg px-3 py-2"
            >
              {getCapabilityIcon(cap)}
              <span className="font-medium text-slate-900">{cap}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
