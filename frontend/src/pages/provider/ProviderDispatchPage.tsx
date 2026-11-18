import { useQuery } from '@tanstack/react-query';
import { ambulanceProviderApi } from '../../services/ambulanceProviderApi';
import { Ambulance, Radio, MapPin, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';

export const ProviderDispatchPage = () => {
  const requests = useQuery({
    queryKey: ['ambulance-provider', 'requests', 'dispatch'],
    queryFn: () => ambulanceProviderApi.getRequests({ limit: 50 }),
    refetchInterval: 5000,
  });

  const ambulances = useQuery({
    queryKey: ['ambulance-provider', 'ambulances', 'dispatch'],
    queryFn: () => ambulanceProviderApi.getAmbulances({ limit: 50 }),
    refetchInterval: 5000,
  });

  const availableAmbulances = (ambulances.data?.items ?? []).filter((a) => a.currentStatus === 'AVAILABLE');
  const activeRequests = (requests.data?.items ?? []).filter((r) => !r.driverId);

  return (
    <div className="space-y-6 font-sans text-zinc-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Live Algorithmic Dispatch Board</h1>
          <p className="text-xs text-zinc-400 mt-1">Real-time emergency queue and GPS-matched ambulance vehicle assignment</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Real-time Telemetry Engine Active</span>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Available Rapid Units</p>
            <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
              <Ambulance className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-light text-emerald-400 tracking-tight font-mono">{availableAmbulances.length}</p>
          <p className="text-xs text-zinc-400 mt-1">Ready for instant dispatch in Jaipur service area</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Unassigned Incoming Emergencies</p>
            <div className="bg-rose-500/10 text-rose-400 p-2 rounded-xl border border-rose-500/20">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-light text-rose-400 tracking-tight font-mono">{activeRequests.length}</p>
          <p className="text-xs text-zinc-400 mt-1">Algorithmic matching in progress</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white tracking-tight">Pending Dispatch Queue</h2>
        {activeRequests.length === 0 ? (
          <div className="py-12 text-center text-zinc-400">
            <CheckCircle2 className="h-8 w-8 text-emerald-400/80 mx-auto mb-2" />
            <p className="text-xs">No unassigned emergency requests waiting in queue. Standby units active.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white bg-white/[0.05] px-2.5 py-0.5 rounded border border-white/10">
                      {req.requestCode}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                      {req.situationType}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-rose-500" />
                    <span>{req.location ?? 'Jaipur jurisdiction'}</span>
                  </p>
                </div>
                <Link
                  to={ROUTES.PROVIDER.REQUESTS}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 shadow-md shadow-rose-950/60 transition-all cursor-pointer"
                >
                  Review & Manual Dispatch
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
