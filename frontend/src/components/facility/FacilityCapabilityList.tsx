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
    return <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('stroke') || lower.includes('neurolog')) {
    return <Brain className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('trauma')) {
    return <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('ambulance') || lower.includes('helipad')) {
    return <Ambulance className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('icu') || lower.includes('emergency')) {
    return <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />;
  }
  return <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />;
}

export const FacilityCapabilityList = ({
  facility,
  className = '',
}: FacilityCapabilityListProps) => {
  const capabilities = facility.capabilities ?? [];
  const departments = facility.departments ?? [];

  return (
    <div className={`bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl space-y-5 font-sans ${className}`}>
      {/* Clinical Departments Section */}
      {departments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
            <Layers className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
            <span>Active Departments & Specialties</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {departments.map((dept) => (
              <div
                key={dept}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.04] border border-white/10 font-medium text-zinc-200 hover:border-white/20 transition-all"
              >
                {getCapabilityIcon(dept)}
                <span className="truncate">{dept}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verified Clinical Capabilities */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
          <Activity className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          <span>Verified Clinical Capabilities</span>
        </div>

        <ul className="space-y-2">
          {capabilities.map((cap) => (
            <li
              key={cap}
              className="flex items-center gap-3 text-xs text-zinc-300 bg-white/[0.02] border border-white/5 rounded-xl px-3.5 py-2.5"
            >
              {getCapabilityIcon(cap)}
              <span className="font-medium text-zinc-100">{cap}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
