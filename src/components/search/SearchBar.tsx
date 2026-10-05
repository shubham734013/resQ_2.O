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
        className="w-full h-11 pl-10 pr-10 text-sm bg-white border border-slate-200 text-slate-900 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-xs"
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search query"
          className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </form>
  );
};
