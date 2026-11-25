import type { FacilityCategory } from '../../types/facility';

export interface FilterChipsProps {
  activeCategory: FacilityCategory;
  onSelectCategory: (cat: FacilityCategory) => void;
  emergencyOnly: boolean;
  onToggleEmergencyOnly: () => void;
  className?: string;
  variant?: 'dark' | 'light';
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
  variant = 'dark',
}: FilterChipsProps) => {
  if (variant === 'light') {
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
  }

  // Dark obsidian glassmorphism design system
  return (
    <div
      role="group"
      aria-label="Filter facilities"
      className={`flex items-center gap-2 overflow-x-auto no-scrollbar py-1 text-xs select-none ${className}`}
    >
      {/* 24/7 Emergency Only Toggle Pill */}
      <button
        type="button"
        onClick={onToggleEmergencyOnly}
        aria-pressed={emergencyOnly}
        className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer flex items-center gap-1.5 shrink-0 ${
          emergencyOnly
            ? 'bg-rose-600 text-white border border-rose-500 shadow-lg shadow-rose-950/50'
            : 'bg-white/[0.04] text-zinc-400 border border-white/10 hover:text-zinc-200 hover:bg-white/[0.08]'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${emergencyOnly ? 'bg-white animate-pulse' : 'bg-rose-500'}`} />
        <span>24/7 Emergency Only</span>
      </button>

      <div className="w-[1px] h-5 bg-white/10 shrink-0 mx-0.5" aria-hidden="true" />

      {/* Segmented Category Filter Pills */}
      <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 p-1 rounded-xl text-xs shrink-0">
        {CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              aria-pressed={isSelected}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 cursor-pointer ${
                isSelected
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
