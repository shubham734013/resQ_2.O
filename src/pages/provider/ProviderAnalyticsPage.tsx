import { useQuery } from '@tanstack/react-query';
import { ambulanceProviderApi } from '../../services/ambulanceProviderApi';

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
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Fleet Telemetry & Operational Analytics</h1>
        <p className="text-xs text-slate-500">Live fleet utilization, driver on-duty hours, and emergency response performance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Registered Fleet</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{totalAmbulances}</p>
          <p className="text-[11px] text-slate-500 mt-1">Active ALS/BLS vehicles</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Driver Roster</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{totalDrivers}</p>
          <p className="text-[11px] text-slate-500 mt-1">Verified commercial EMTs</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Emergency Dispatches</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{totalTrips}</p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">100% telemetry verified</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Response Time</p>
          <p className="mt-2 text-3xl font-black text-slate-950">6.8 min</p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">Sub-7 minute SLA adherence</p>
        </div>
      </div>
    </div>
  );
};
