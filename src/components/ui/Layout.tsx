import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from './Button';
import { usePageTheme } from '../layout/pageTheme';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
        <span aria-hidden="true" className="h-5 w-1.5 rounded-full bg-gradient-to-b from-brand-400 to-brand-700" />
        {title}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const theme = usePageTheme();
  return (
    <header className={`relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br ${theme.gradient} p-6 shadow-card`}>
      {/* Section motif keeps each tab recognisable while the colour stays constant. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20 brightness-0 invert"
        style={{ backgroundImage: theme.motif, backgroundRepeat: 'repeat' }}
      />
      {/* Decorative light blooms keep the band from looking flat. */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-black/10 blur-2xl" />
      <span aria-hidden="true" className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 text-7xl opacity-20 sm:block">
        {theme.icon}
      </span>

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">{title}</h1>
          {subtitle ? <p className="mt-1.5 max-w-xl text-base font-medium text-white/85">{subtitle}</p> : null}
        </div>
        {action}
      </div>
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
      ? 'border-brand-300/70 bg-gradient-to-br from-brand-50 to-white dark:border-brand-700/60 dark:from-brand-900/40 dark:to-slate-900'
      : tone === 'bad'
        ? 'border-red-300/70 bg-gradient-to-br from-red-50 to-white dark:border-red-800/60 dark:from-red-900/30 dark:to-slate-900'
        : 'border-white/70 bg-white/85 dark:border-slate-700/60 dark:bg-slate-900/80';

  return (
    <div className={`rounded-2xl border p-4 shadow-soft backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-card ${toneClass}`}>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">{loading ? <Spinner /> : value}</p>
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
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-4xl shadow-inner dark:from-brand-900 dark:to-brand-800">
        🌱
      </span>
      <p className="max-w-sm text-base font-medium text-slate-700 dark:text-slate-300">{message}</p>
      {actionLabel && to ? (
        <Link
          to={to}
          className="min-h-touch rounded-2xl bg-gradient-to-b from-brand-600 to-brand-700 px-6 py-3 text-base font-bold text-white shadow-soft hover:from-brand-500"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="min-h-touch rounded-2xl bg-gradient-to-b from-brand-600 to-brand-700 px-6 py-3 text-base font-bold text-white shadow-soft hover:from-brand-500"
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
