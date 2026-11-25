import { useRef } from 'react';
import type { FormEvent } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSubmit?: (e: FormEvent) => void;
  autoFocus?: boolean;
  className?: string;
  id?: string;
  variant?: 'dark' | 'light';
}

export const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search hospitals, emergency care, capabilities...',
  onClear,
  onSubmit,
  autoFocus = false,
  className = '',
  id = 'resq-search-input',
  variant = 'dark',
}: SearchBarProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    onClear?.();
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  if (variant === 'light') {
    return (
      <form
        role="search"
        onSubmit={handleSubmit}
        className={`relative flex items-center w-full ${className}`}
      >
        <label htmlFor={id} className="sr-only">
          Search healthcare facilities and services
        </label>

        <div className="absolute left-3.5 pointer-events-none text-slate-400 flex items-center">
          <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck="false"
          className="w-full h-11 pl-10 pr-10 text-sm bg-white border border-slate-200 text-slate-900 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-xs"
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search query"
            className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </form>
    );
  }

  // Dark obsidian glassmorphism design system
  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={`relative flex items-center w-full ${className}`}
    >
      <label htmlFor={id} className="sr-only">
        Search healthcare facilities and services
      </label>

      <div className="absolute left-4 pointer-events-none text-zinc-400 flex items-center">
        <Search className="w-4 h-4 text-zinc-400" aria-hidden="true" />
      </div>

      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck="false"
        className="w-full bg-white/[0.04] border border-white/10 text-zinc-100 placeholder:text-zinc-500 rounded-xl px-4 py-3 pl-11 pr-10 focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 outline-none text-sm shadow-inner transition-all"
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search query"
          className="absolute right-3 p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </form>
  );
};
