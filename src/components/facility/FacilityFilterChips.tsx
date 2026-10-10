import type { FacilityCategory } from '../../types/facility';

export interface FilterChipsProps {
  activeCategory: FacilityCategory;
  onSelectCategory: (cat: FacilityCategory) => void;
  emergencyOnly: boolean;
  onToggleEmergencyOnly: () => void;
  className?: string;
}

const CATEGORIES: { id: FacilityCategory; label: string }[] = [
  { id: 'all', label: 'All Facilities' },
  { id: 'emergency', label: 'Emergency & Trauma' },
  { id: 'cardiology', label: 'Cardiology' },
  { id: 'neurology', label: 'Neurology' },
  { id: 'orthopaedics', label: 'Orthopaedics' },
  { id: 'pediatric', label: 'Paediatrics' },
  { id: 'maternity', label: 'Maternity' },
  { id: 'multispeciality', label: 'Multispeciality' },
  { id: 'urgent_care', label: 'Urgent Care' },
  { id: 'general', label: 'General Hospital' },
];

export const FacilityFilterChips = ({
  activeCategory,
  onSelectCategory,
  emergencyOnly,
  onToggleEmergencyOnly,
  className = '',
}: FilterChipsProps) => {
  return (
    <div
      role="group"
      aria-label="Filter facilities"
      className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs select-none ${className}`}
    >
      <button
        type="button"
        onClick={onToggleEmergencyOnly}
        aria-pressed={emergencyOnly}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 cursor-pointer ${
          emergencyOnly
            ? 'bg-rose-700 text-white shadow-xs'
            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
        }`}
      >
        ● 24/7 Emergency Only
      </button>

      <div className="w-[1px] h-4 bg-slate-200 shrink-0 mx-0.5" aria-hidden="true" />

      {CATEGORIES.map((cat) => {
        const isSelected = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            aria-pressed={isSelected}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer ${
              isSelected
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
};
