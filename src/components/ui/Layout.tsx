import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from './Button';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-base text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

/**
 * Profit / loss indicator.
 * Colour is never the only signal - the arrow glyph and the sign carry the
 * same information for colour-blind users and screen readers.
 */
export function TrendValue({ value, formatted, invert = false }: { value: number; formatted: string; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const tone = positive
    ? 'text-brand-800 dark:text-brand-300'
    : negative
      ? 'text-red-800 dark:text-red-300'
      : 'text-slate-700 dark:text-slate-300';
  const glyph = positive ? '▲' : negative ? '▼' : '•';
  return (
    <span className={`font-bold ${tone}`}>
      <span aria-hidden="true">{glyph} </span>
      {formatted}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  loading = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'good' | 'bad';
  loading?: boolean;
}) {
  const toneClass =
    tone === 'good'
      ? 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/30'
      : tone === 'bad'
        ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/30'
        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${toneClass}`}>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">{loading ? <Spinner /> : value}</p>
      {hint ? <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
  to,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  to?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 py-8 text-center">
      <span aria-hidden="true" className="text-4xl">
        🌱
      </span>
      <p className="text-base font-medium text-slate-700 dark:text-slate-300">{message}</p>
      {actionLabel && to ? (
        <Link
          to={to}
          className="min-h-touch rounded-xl bg-brand-700 px-5 py-3 text-base font-semibold text-white hover:bg-brand-800"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="min-h-touch rounded-xl bg-brand-700 px-5 py-3 text-base font-semibold text-white hover:bg-brand-800"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-600 dark:text-slate-400">
      <Spinner label={label} />
      <span>{label}</span>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'info' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    good: 'bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100',
    bad: 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100',
    info: 'bg-soil-100 text-soil-700 dark:bg-soil-700 dark:text-soil-50',
  } as const;
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}
