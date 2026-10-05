import { Bookmark, Building2 } from 'lucide-react';
import { MOCK_FACILITIES } from '../data/mockFacilities';
import { FacilityCard } from '../components/facility/FacilityCard';
import { useNavigate } from 'react-router-dom';

export const SavedPage = () => {
  const navigate = useNavigate();
  // Provide 2 saved facilities for illustration
  const savedFacilities = [MOCK_FACILITIES[0], MOCK_FACILITIES[1]];

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-slate-700" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Saved Facilities
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Quick-access list of your verified preferred hospitals and emergency destinations.
        </p>
      </header>

      {savedFacilities.length > 0 ? (
        <section aria-label="Bookmarked facilities list" className="space-y-3">
          <div className="text-xs text-slate-500 px-1 font-medium">
            {savedFacilities.length} saved emergency locations
          </div>
          {savedFacilities.map((fac) => (
            <FacilityCard
              key={fac.id}
              facility={fac}
              isSelected={false}
              onSelect={() => navigate('/')}
            />
          ))}
        </section>
      ) : (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-700 text-sm">No saved facilities yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You can bookmark trauma centers, pediatric emergency rooms, or urgent care clinics for fast one-tap navigation.
          </p>
        </div>
      )}
    </div>
  );
};
