import { Bookmark, Building2, Trash2, ArrowRight, Flame } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useRemoveSavedFacility, useSavedFacilities } from '../hooks/useUser';
import { Button } from '../components/common/Button';

export const SavedPage = () => {
  const navigate = useNavigate();
  const q = useSavedFacilities();
  const remove = useRemoveSavedFacility();

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <header className="space-y-1.5 pb-2 border-b border-slate-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-[11px] font-semibold">
          <Bookmark className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
          <span>Care Directory Bookmarks</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
          Saved Facilities
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Your bookmarked hospitals, clinics, and emergency centers for fast access during care coordination.
        </p>
      </header>

      {q.isLoading ? (
        <div className="p-12 text-center text-sm text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading saved facilities…</p>
        </div>
      ) : q.isError ? (
        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-800 space-y-2">
          <p className="font-semibold">Unable to load saved facilities.</p>
          <Button size="sm" variant="secondary" onClick={() => void q.refetch()}>
            Retry
          </Button>
        </div>
      ) : !q.data?.items.length ? (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm sm:text-base">No saved facilities yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            When you browse verified hospitals or clinics, save them here for quick one-tap directions, emergency care, or appointment booking.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight className="w-3.5 h-3.5" />}
              iconPosition="right"
              onClick={() => navigate('/search')}
              className="font-semibold shadow-xs"
            >
              Browse Facilities
            </Button>
          </div>
        </div>
      ) : (
        <section aria-label="Saved facilities" className="space-y-3.5">
          <div className="text-xs text-slate-500 px-1 font-semibold flex items-center justify-between">
            <span>{q.data.items.length} saved {q.data.items.length === 1 ? 'facility' : 'facilities'}</span>
            <span className="text-teal-700 font-medium">Verified directory</span>
          </div>

          <div className="grid gap-3">
            {q.data.items.map((facility) => (
              <article
                key={facility.id}
                className="resq-card-hover rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-slate-900 text-base sm:text-lg truncate">
                      {facility.name}
                    </h2>
                    {facility.hospitalType && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                        {facility.hospitalType}
                      </span>
                    )}
                    {facility.emergencyAvailability === 'AVAILABLE' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
                        <Flame className="h-3 w-3" /> Emergency Available
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {[facility.address, facility.city, facility.state].filter(Boolean).join(', ') || 'Address unavailable'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <Link
                    to={`/facility/${facility.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200/80 text-xs font-bold text-teal-800 hover:bg-teal-100/70 transition-colors"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    aria-label={`Remove ${facility.name} from saved facilities`}
                    onClick={() => remove.mutate(facility.id)}
                    icon={<Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-600" />}
                    className="hover:bg-rose-50"
                  >
                    Remove
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
