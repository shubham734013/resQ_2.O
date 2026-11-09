import type { ReactNode } from 'react';
import { Search, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { Button } from '../common/Button';
import type { AdminMetric } from '../../types/admin';

// ─── Card wrapper ─────────────────────────────────────────────────────────────
const darkCard = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.07)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
} as const;

// ─── AdminPage layout ─────────────────────────────────────────────────────────
export const AdminPage = ({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) => (
  <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 xl:px-10 xl:py-10">
    {/* Page header */}
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end mb-8">
      <div>
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          ResQ 2.O · Operations Command
        </p>
        <h2
          className="text-2xl sm:text-3xl font-light tracking-tight"
          style={{ color: 'rgba(255,255,255,0.94)' }}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
    <div>{children}</div>
  </div>
);

// ─── Metric Grid ──────────────────────────────────────────────────────────────
export const MetricGrid = ({ metrics }: { metrics: AdminMetric[] }) => (
  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
    {metrics.map(metric => (
      <div
        key={metric.label}
        className="rounded-2xl p-6 transition-all duration-200"
        style={{
          ...darkCard,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
        }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'rgba(255,255,255,0.32)' }}
        >
          {metric.label}
        </p>
        <div className="flex items-end justify-between gap-2 mb-1">
          <p
            className="text-3xl font-light tracking-tight"
            style={{ color: 'rgba(255,255,255,0.94)' }}
          >
            {metric.value}
          </p>
          {metric.trend && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.18)' }}
            >
              <TrendingUp className="h-2.5 w-2.5" />
              {metric.trend}
            </span>
          )}
        </div>
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
          {metric.detail}
        </p>
      </div>
    ))}
  </div>
);

// ─── Panel ─────────────────────────────────────────────────────────────────────
export const Panel = ({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={`rounded-2xl overflow-hidden ${className}`}
    style={darkCard}
  >
    <div
      className="px-5 py-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
        {title}
      </h3>
      {description && (
        <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.36)' }}>
          {description}
        </p>
      )}
    </div>
    <div>{children}</div>
  </section>
);

// ─── Filter Bar ───────────────────────────────────────────────────────────────
export const FilterBar = ({
  placeholder = 'Search',
  onSearch,
}: {
  placeholder?: string;
  onSearch?: (value: string) => void;
}) => (
  <div className="flex flex-col gap-2 sm:flex-row">
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: 'rgba(255,255,255,0.28)' }}
      />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={event => onSearch?.(event.target.value)}
        className="h-10 w-full rounded-xl pl-9 pr-3 text-sm outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.88)',
          fontFamily: 'var(--font-sans)',
        }}
        onFocus={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.40)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(244,63,94,0.08)';
        }}
        onBlur={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      />
    </div>
    <Button type="button" variant="secondary" icon={<SlidersHorizontal className="h-4 w-4" />}>
      Filters
    </Button>
  </div>
);

// ─── Status Dot ───────────────────────────────────────────────────────────────
export const StatusDot = ({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'good' | 'warning' | 'danger' | 'neutral';
}) => {
  const styles = {
    good:    'bg-emerald-400',
    warning: 'bg-amber-400',
    danger:  'bg-rose-400',
    neutral: 'bg-slate-500',
  };
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.60)' }}>
      <span className={`h-1.5 w-1.5 rounded-full ${styles[tone]}`} />
      {label}
    </span>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
export const EmptyState = ({ label }: { label: string }) => (
  <div className="px-5 py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
    {label}
  </div>
);
