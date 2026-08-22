import { useLocation } from 'react-router-dom';

/**
 * Per-section visual identity. Every tab gets its own accent gradient, icon and
 * ambient background so the app feels designed rather than generic, while the
 * green brand keeps everything family-resemblant.
 */
export interface PageTheme {
  key: string;
  icon: string;
  /** Tailwind gradient stops for headers, icons and accents. */
  gradient: string;
  /** Soft ambient wash painted behind the page content. */
  glow: string;
  /** Tint for the section accent bar and chips. */
  ring: string;
}

const THEMES: Record<string, PageTheme> = {
  dashboard: {
    key: 'dashboard',
    icon: '🏠',
    gradient: 'from-emerald-500 to-green-700',
    glow: 'rgba(16,185,129,0.20)',
    ring: 'ring-emerald-200',
  },
  farms: {
    key: 'farms',
    icon: '🌾',
    gradient: 'from-lime-500 to-green-700',
    glow: 'rgba(132,204,22,0.20)',
    ring: 'ring-lime-200',
  },
  crops: {
    key: 'crops',
    icon: '🌱',
    gradient: 'from-green-400 to-emerald-700',
    glow: 'rgba(52,211,153,0.20)',
    ring: 'ring-green-200',
  },
  seasons: {
    key: 'seasons',
    icon: '📅',
    gradient: 'from-teal-500 to-emerald-700',
    glow: 'rgba(20,184,166,0.18)',
    ring: 'ring-teal-200',
  },
  activities: {
    key: 'activities',
    icon: '🚜',
    gradient: 'from-amber-500 to-orange-700',
    glow: 'rgba(245,158,11,0.20)',
    ring: 'ring-amber-200',
  },
  expenses: {
    key: 'expenses',
    icon: '💰',
    gradient: 'from-rose-500 to-red-700',
    glow: 'rgba(244,63,94,0.16)',
    ring: 'ring-rose-200',
  },
  irrigation: {
    key: 'irrigation',
    icon: '💧',
    gradient: 'from-sky-500 to-blue-700',
    glow: 'rgba(14,165,233,0.20)',
    ring: 'ring-sky-200',
  },
  sprays: {
    key: 'sprays',
    icon: '🧴',
    gradient: 'from-violet-500 to-purple-700',
    glow: 'rgba(139,92,246,0.18)',
    ring: 'ring-violet-200',
  },
  fertilizers: {
    key: 'fertilizers',
    icon: '🧪',
    gradient: 'from-cyan-500 to-teal-700',
    glow: 'rgba(6,182,212,0.18)',
    ring: 'ring-cyan-200',
  },
  seeds: {
    key: 'seeds',
    icon: '🌰',
    gradient: 'from-yellow-500 to-amber-700',
    glow: 'rgba(234,179,8,0.18)',
    ring: 'ring-yellow-200',
  },
  harvest: {
    key: 'harvest',
    icon: '🧺',
    gradient: 'from-orange-500 to-amber-700',
    glow: 'rgba(249,115,22,0.20)',
    ring: 'ring-orange-200',
  },
  sales: {
    key: 'sales',
    icon: '🏷️',
    gradient: 'from-fuchsia-500 to-purple-700',
    glow: 'rgba(217,70,239,0.16)',
    ring: 'ring-fuchsia-200',
  },
  reports: {
    key: 'reports',
    icon: '📊',
    gradient: 'from-indigo-500 to-blue-800',
    glow: 'rgba(99,102,241,0.18)',
    ring: 'ring-indigo-200',
  },
  settings: {
    key: 'settings',
    icon: '⚙️',
    gradient: 'from-slate-500 to-slate-800',
    glow: 'rgba(100,116,139,0.18)',
    ring: 'ring-slate-200',
  },
  search: {
    key: 'search',
    icon: '🔍',
    gradient: 'from-emerald-500 to-teal-700',
    glow: 'rgba(16,185,129,0.16)',
    ring: 'ring-emerald-200',
  },
  add: {
    key: 'add',
    icon: '➕',
    gradient: 'from-emerald-500 to-green-700',
    glow: 'rgba(16,185,129,0.20)',
    ring: 'ring-emerald-200',
  },
  more: {
    key: 'more',
    icon: '☰',
    gradient: 'from-emerald-500 to-green-700',
    glow: 'rgba(16,185,129,0.18)',
    ring: 'ring-emerald-200',
  },
};

/** Maps the first path segment to a theme, falling back to the dashboard look. */
export function themeForPath(pathname: string): PageTheme {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return THEMES.dashboard;
  return THEMES[segment] ?? THEMES.dashboard;
}

export function usePageTheme(): PageTheme {
  const { pathname } = useLocation();
  return themeForPath(pathname);
}
