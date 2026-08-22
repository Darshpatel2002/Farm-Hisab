import { useLocation } from 'react-router-dom';
import { SCENES } from './scenery';

/**
 * Per-section visual identity.
 *
 * The brand green is identical on every tab so the app reads as one product.
 * What changes per tab is the hero artwork, which lives ONLY in the page
 * header - the content area stays clean so the data is always easy to read.
 */

/** One green for the whole app - used by page headers, nav and dialogs. */
export const BRAND_GRADIENT = 'from-brand-500 via-brand-600 to-brand-800';

export interface PageTheme {
  key: string;
  icon: string;
  /** Shared brand gradient - identical on every tab. */
  gradient: string;
  /** Hero illustration for this module. */
  scene: string;
}

const ICONS: Record<string, string> = {
  dashboard: '🏠',
  farms: '🌾',
  crops: '🌱',
  seasons: '📅',
  activities: '🚜',
  expenses: '💰',
  irrigation: '💧',
  sprays: '🧴',
  fertilizers: '🧪',
  seeds: '🌰',
  harvest: '🧺',
  sales: '🏷️',
  reports: '📊',
  settings: '⚙️',
  assistant: '🤖',
  search: '🔍',
  add: '➕',
  more: '☰',
};

const THEMES: Record<string, PageTheme> = Object.fromEntries(
  Object.keys(ICONS).map((key) => [
    key,
    { key, icon: ICONS[key], gradient: BRAND_GRADIENT, scene: SCENES[key] ?? SCENES.dashboard },
  ]),
);

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
