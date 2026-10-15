import { useQuery } from '@tanstack/react-query';
import { ambulanceProviderApi } from '../../services/ambulanceProviderApi';
import { Button } from '../../components/common/Button';

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
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Live Algorithmic Dispatch Board</h1>
          <p className="text-xs text-slate-500">Real-time emergency queue and GPS-matched ambulance vehicle assignment</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time Telemetry Engine Active</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Available Rapid Units</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{availableAmbulances.length}</p>
          <p className="text-xs text-slate-500 mt-1">Ready for instant dispatch in Jaipur service area</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Unassigned Incoming Emergencies</p>
          <p className="mt-2 text-3xl font-black text-rose-600">{activeRequests.length}</p>
          <p className="text-xs text-slate-500 mt-1">Algorithmic matching in progress</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-950 mb-4">Pending Dispatch Queue</h2>
        {activeRequests.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No unassigned emergency requests waiting in queue.</p>
        ) : (
          <div className="space-y-3">
            {activeRequests.map((req) => (
              <div key={req.id} className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{req.requestCode}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      {req.situationType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{req.location ?? 'Location unavailable'}</p>
                </div>
                <Button size="sm" variant="primary">
                  Review & Manual Dispatch
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
