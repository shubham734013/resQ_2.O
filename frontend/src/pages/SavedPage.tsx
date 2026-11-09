import { Bookmark, Trash2, ArrowRight, Flame } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useRemoveSavedFacility, useSavedFacilities } from '../hooks/useUser';

export const SavedPage = () => {
  const navigate = useNavigate();
  const q = useSavedFacilities();
  const remove = useRemoveSavedFacility();

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="space-y-2 pb-5 border-b border-white/10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
          <Bookmark className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
          <span>Care Directory Bookmarks</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight">
          Saved Facilities
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Your bookmarked hospitals, trauma clinics, and emergency centers for one-touch navigation.
        </p>
      </header>

      {/* ── Content States ────────────────────────────────────────────── */}
      {q.isLoading ? (
        <div className="p-16 text-center text-sm text-zinc-400 space-y-3 font-mono">
          <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading saved facility bookmarks…</p>
        </div>
      ) : q.isError ? (
        <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 space-y-3 backdrop-blur-md">
          <p className="font-semibold text-sm">Unable to load saved facilities.</p>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-200 text-xs font-semibold transition cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : !q.data?.items.length ? (
        /* Empty State */
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center shadow-2xl space-y-6">
          <div className="bg-rose-500/10 text-rose-400 p-5 rounded-2xl border border-rose-500/20 inline-flex items-center justify-center shadow-lg shadow-rose-950/40">
            <Bookmark className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-light text-zinc-100 text-lg sm:text-xl tracking-tight">No saved facilities yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              When you browse verified hospitals or clinics, bookmark them here for quick one-tap directions, emergency triage, or doctor appointments.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/user/hospitals')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-950/50 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <span>Browse Facilities</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Saved Items List */
        <section aria-label="Saved facilities" className="space-y-4">
          <div className="text-xs text-zinc-400 px-1 font-mono flex items-center justify-between">
            <span>
              {q.data.items.length} SAVED {q.data.items.length === 1 ? 'FACILITY' : 'FACILITIES'}
            </span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Verified Directory
            </span>
          </div>

          <div className="grid gap-3.5">
            {q.data.items.map((facility) => (
              <article
                key={facility.id}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-white/20 hover:bg-white/[0.04] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl group"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-semibold text-zinc-100 text-base sm:text-lg truncate group-hover:text-rose-200 transition-colors">
                      {facility.name}
                    </h2>
                    {facility.hospitalType && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-mono text-zinc-400 border border-white/5">
                        {facility.hospitalType}
                      </span>
                    )}
                    {facility.emergencyAvailability === 'AVAILABLE' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-300 border border-rose-500/20">
                        <Flame className="h-3 w-3 text-rose-400 animate-pulse" />
                        24/7 Emergency Available
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    {[facility.address, facility.city, facility.state].filter(Boolean).join(', ') || 'Address unavailable'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  <Link
                    to={`/user/hospitals/${facility.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                  </Link>

                  <button
                    type="button"
                    disabled={remove.isPending}
                    aria-label={`Remove ${facility.name} from saved facilities`}
                    onClick={() => remove.mutate(facility.id)}
                    className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                    title="Remove Bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
