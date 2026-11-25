import { Clock, Activity, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { useHospitalProfile, useHospitalEmergencies, useHospitalPatients } from '../../hooks/useHospitalManagement';

export const HospitalAnalyticsPage = () => {
  const profile = useHospitalProfile();
  const emergencies = useHospitalEmergencies({ page: 1, limit: 100 });
  const patients = useHospitalPatients({ page: 1, limit: 100 });

  const totalEmergencies = emergencies.data?.pagination.total ?? 0;
  const totalPatients = patients.data?.pagination.total ?? 0;
  const resolvedEmergencies = (emergencies.data?.items ?? []).filter((e) => e.status === 'RESOLVED').length;
  const activeCoordination = (emergencies.data?.items ?? []).filter((e) =>
    ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(e.status)
  ).length;

  const resourceEntries = Object.entries(profile.data?.resourceSummary ?? {});

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Clinical & Operational Analytics</h1>
          <p className="text-xs text-zinc-400 mt-1">Real-time emergency intake SLA, triage wait times, and facility capacity metrics</p>
        </div>
        <div className="flex items-center gap-2.5 text-xs font-mono text-emerald-300 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 backdrop-blur-xl shadow-lg shadow-emerald-950/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>NABH / ABDM Accreditation Tier 1</span>
        </div>
      </div>

      {/* KPI Bento Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Resolved Emergencies */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl hover:border-white/20 transition-all group">
          <div className="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-teal-500/10 blur-xl group-hover:bg-teal-500/20 transition-all" />
          <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-zinc-400">
            <span>Resolved Cases</span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <Clock className="h-4 w-4 text-teal-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-light font-mono text-zinc-100 tracking-tight">
            {resolvedEmergencies}
          </p>
          <p className="mt-1 text-[11px] text-teal-400 font-mono flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400" />
            Successfully coordinated cases
          </p>
        </div>

        {/* Card 2: Total Emergency Intake */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl hover:border-white/20 transition-all group">
          <div className="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-rose-500/10 blur-xl group-hover:bg-rose-500/20 transition-all" />
          <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-zinc-400">
            <span>Total Intake</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Activity className="h-4 w-4 text-rose-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-light font-mono text-zinc-100 tracking-tight">
            {totalEmergencies}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400 font-mono">
            Logged in current cycle
          </p>
        </div>

        {/* Card 3: Active Inpatients */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl hover:border-white/20 transition-all group">
          <div className="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-blue-500/10 blur-xl group-hover:bg-blue-500/20 transition-all" />
          <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-zinc-400">
            <span>Active Inpatients</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-light font-mono text-zinc-100 tracking-tight">
            {totalPatients}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400 font-mono">
            Coordinated via ResQ registry
          </p>
        </div>

        {/* Card 4: Active Coordination */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl hover:border-white/20 transition-all group">
          <div className="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-zinc-400">
            <span>Active Coordination</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-light font-mono text-zinc-100 tracking-tight">
            {activeCoordination}
          </p>
          <p className="mt-1 text-[11px] text-amber-400 font-mono flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            In-flight cases requiring attention
          </p>
        </div>
      </div>

      {/* Resource & Bed Allocation Breakdown */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 shadow-xl space-y-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Resource Allocation Summary</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Live allocation across specialized departments, wards, and intensive care units</p>
        </div>

        {resourceEntries.length === 0 ? (
          <div className="p-10 text-center rounded-xl border border-dashed border-white/10 text-xs font-mono text-zinc-500 bg-white/[0.01]">
            No resource allocations currently configured for this hospital.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {resourceEntries.map(([key, val]) => (
              <div
                key={key}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-white/15 transition-all group"
              >
                <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">
                  {key.replace(/[_-]/g, ' ')}
                </p>
                <p className="mt-1.5 text-2xl font-light font-mono text-zinc-100 group-hover:text-rose-300 transition-colors">
                  {val}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
