import { ShieldCheck, Flame, Clock } from 'lucide-react';

export type StatusBadgeVariant =
  | 'emergency'
  | 'verified'
  | 'urgent'
  | 'waitTime'
  | 'open'
  | 'closed'
  | 'neutral';

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
  icon?: boolean;
  className?: string;
}

export const StatusBadge = ({
  variant,
  label,
  size = 'sm',
  icon = true,
  className = '',
}: StatusBadgeProps) => {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5 font-medium';

  switch (variant) {
    case 'emergency':
      return (
        <span
          className={`inline-flex items-center font-medium bg-rose-50 text-rose-800 border border-rose-200/80 rounded-md tracking-tight ${sizeClasses} ${className}`}
        >
          {icon && <Flame className="w-3 h-3 text-rose-600 shrink-0" aria-hidden="true" />}
          <span>{label ?? '24/7 Emergency'}</span>
        </span>
      );

    case 'verified':
      return (
        <span
          className={`inline-flex items-center font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/70 rounded-md ${sizeClasses} ${className}`}
        >
          {icon && <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />}
          <span>{label ?? 'Verified'}</span>
        </span>
      );

    case 'waitTime':
      return (
        <span
          className={`inline-flex items-center font-normal bg-slate-100 text-slate-700 border border-slate-200 rounded-md ${sizeClasses} ${className}`}
        >
          {icon && <Clock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />}
          <span>{label}</span>
        </span>
      );

    case 'open':
      return (
        <span
          className={`inline-flex items-center font-medium bg-slate-50 text-slate-700 border border-slate-200 rounded-md ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
          <span>{label ?? 'Open Now'}</span>
        </span>
      );

    case 'closed':
      return (
        <span
          className={`inline-flex items-center font-medium bg-slate-50 text-slate-500 border border-slate-200 rounded-md ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
          <span>{label ?? 'Closed'}</span>
        </span>
      );

    case 'urgent':
      return (
        <span
          className={`inline-flex items-center font-medium bg-blue-50 text-blue-800 border border-blue-200/70 rounded-md ${sizeClasses} ${className}`}
        >
          <span>{label ?? 'Urgent Care'}</span>
        </span>
      );

    case 'neutral':
    default:
      return (
        <span
          className={`inline-flex items-center font-normal bg-slate-100 text-slate-600 border border-slate-200 rounded-md ${sizeClasses} ${className}`}
        >
          <span>{label}</span>
        </span>
      );
  }
};
