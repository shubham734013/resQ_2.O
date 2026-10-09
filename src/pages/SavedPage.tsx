import { Bookmark, Building2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRemoveSavedFacility, useSavedFacilities } from '../hooks/useUser';
import { Button } from '../components/common/Button';

export const SavedPage=()=>{
  const q=useSavedFacilities();
  const remove=useRemoveSavedFacility();
  return <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
    <header className="space-y-1">
      <div className="flex items-center gap-2"><Bookmark className="w-5 h-5 text-slate-700" aria-hidden="true"/><h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Saved Facilities</h1></div>
      <p className="text-sm text-slate-500">Your persistent list of active and verified healthcare facilities.</p>
    </header>
    {q.isLoading?<div className="p-12 text-center text-sm text-slate-500">Loading saved facilities…</div>:
    q.isError?<div className="p-5 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-800"><div className="flex items-center justify-between gap-3"><span>Unable to load saved facilities.</span><Button size="sm" variant="secondary" onClick={()=>void q.refetch()}>Retry</Button></div></div>:
    !q.data?.items.length?<div className="p-12 text-center bg-white border border-slate-200 rounded-xl"><Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2"/><h3 className="font-semibold text-slate-700 text-sm">No saved facilities yet</h3><p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Open a verified facility and save it for faster access.</p></div>:
    <section aria-label="Saved facilities" className="space-y-3">
      <div className="text-xs text-slate-500 px-1 font-medium">{q.data.items.length} saved facilities</div>
      {q.data.items.map((facility)=><article key={facility.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4">
        <div className="min-w-0"><h2 className="font-semibold text-slate-900 truncate">{facility.name}</h2><p className="text-xs text-slate-500 mt-1">{[facility.address,facility.city,facility.state].filter(Boolean).join(', ')||'Address unavailable'}</p><p className="text-[11px] text-slate-500 mt-1">{facility.emergencyAvailability}</p></div>
        <div className="flex items-center gap-2 shrink-0"><Link to={`/facility/${facility.id}`} className="text-sm font-semibold text-slate-800 hover:underline">View</Link><Button size="sm" variant="ghost" disabled={remove.isPending} aria-label={`Remove ${facility.name} from saved facilities`} onClick={()=>remove.mutate(facility.id)} icon={<Trash2 className="w-4 h-4"/>}>Remove</Button></div>
      </article>)}
    </section>}
  </div>;
};
