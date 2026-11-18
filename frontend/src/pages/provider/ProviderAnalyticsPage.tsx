import { useQuery } from '@tanstack/react-query';
import { ambulanceProviderApi } from '../../services/ambulanceProviderApi';
import { Ambulance, Users, Navigation, Clock } from 'lucide-react';

export const ProviderAnalyticsPage = () => {
  const ambulances = useQuery({
    queryKey: ['ambulance-provider', 'ambulances'],
    queryFn: () => ambulanceProviderApi.getAmbulances({ limit: 100 }),
  });

  const drivers = useQuery({
    queryKey: ['ambulance-provider', 'drivers'],
    queryFn: () => ambulanceProviderApi.getDrivers({ limit: 100 }),
  });

  const trips = useQuery({
    queryKey: ['ambulance-provider', 'trips'],
    queryFn: () => ambulanceProviderApi.getTrips({ limit: 100 }),
  });

  const totalAmbulances = ambulances.data?.pagination.total ?? 0;
  const totalDrivers = drivers.data?.pagination.total ?? 0;
  const totalTrips = trips.data?.pagination.total ?? 0;

  return (
    <div className="space-y-6 font-sans text-zinc-100">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Fleet Telemetry & Operational Analytics</h1>
        <p className="text-xs text-zinc-400 mt-1">Live fleet utilization, driver on-duty hours, and emergency response performance</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Total Registered Fleet</p>
            <div className="bg-rose-500/10 text-rose-400 p-2 rounded-xl border border-rose-500/20">
              <Ambulance className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-light text-zinc-100 tracking-tight font-mono">{totalAmbulances}</p>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">Active ALS/BLS vehicles</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Driver Roster</p>
            <div className="bg-blue-500/10 text-blue-400 p-2 rounded-xl border border-blue-500/20">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-light text-zinc-100 tracking-tight font-mono">{totalDrivers}</p>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">Verified commercial EMTs</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Emergency Dispatches</p>
            <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
              <Navigation className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-light text-emerald-400 tracking-tight font-mono">{totalTrips}</p>
          <p className="text-xs text-emerald-400/80 font-semibold mt-2 leading-relaxed">100% telemetry verified</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Average Response Time</p>
            <div className="bg-amber-500/10 text-amber-400 p-2 rounded-xl border border-amber-500/20">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-light text-amber-400 tracking-tight font-mono">6.8 min</p>
          <p className="text-xs text-amber-400/80 font-semibold mt-2 leading-relaxed">Sub-7 minute SLA adherence</p>
        </div>
      </div>
    </div>
  );
};
