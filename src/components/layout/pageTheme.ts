import { useLocation } from 'react-router-dom';

/**
 * Per-section visual identity.
 *
 * The brand green is deliberately identical on every tab (headers, active nav,
 * dialog bars) so the app reads as one product. What changes per tab is the
 * decorative background motif, which fills empty space and tells you at a
 * glance which section you are in.
 */

/** One green for the whole app - used by page headers, nav and dialogs. */
export const BRAND_GRADIENT = 'from-brand-500 via-brand-600 to-brand-800';

/** Builds a tiling background-image from inline SVG - no network assets needed. */
function tile(size: number, body: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const S = "fill='none' stroke='#16a34a' stroke-width='1.4' stroke-linecap='round'";

const MOTIFS = {
  sprout: tile(80, `<g ${S}><path d='M40 68V38'/><path d='M40 46c-10 0-16-6-16-14 8 0 16 5 16 14z'/><path d='M40 40c10 0 16-6 16-14-8 0-16 5-16 14z'/></g>`),
  wheat: tile(90, `<g ${S}><path d='M45 76V30'/><path d='M45 36c-8-2-12-8-12-14 7 1 12 6 12 14z'/><path d='M45 36c8-2 12-8 12-14-7 1-12 6-12 14z'/><path d='M45 50c-8-2-12-8-12-14 7 1 12 6 12 14z'/><path d='M45 50c8-2 12-8 12-14-7 1-12 6-12 14z'/></g>`),
  calendar: tile(70, `<g ${S}><rect x='16' y='20' width='38' height='34' rx='5'/><path d='M16 30h38M26 20v-6M44 20v-6'/><path d='M26 40h6M38 40h6M26 47h6'/></g>`),
  tractor: tile(90, `<g ${S}><circle cx='28' cy='60' r='13'/><circle cx='62' cy='64' r='9'/><path d='M28 47V34h16l6 13'/></g>`),
  droplet: tile(70, `<g ${S}><path d='M35 18c9 11 14 18 14 25a14 14 0 1 1-28 0c0-7 5-14 14-25z'/></g>`),
  spray: tile(80, `<g ${S}><rect x='30' y='30' width='20' height='34' rx='5'/><path d='M36 30v-8h10v8'/><path d='M56 22h6M56 30h8M56 38h6'/></g>`),
  flask: tile(80, `<g ${S}><path d='M34 20v18L22 60a6 6 0 0 0 5 9h26a6 6 0 0 0 5-9L46 38V20z'/><path d='M31 20h18'/></g>`),
  seed: tile(70, `<g ${S}><ellipse cx='35' cy='35' rx='11' ry='16' transform='rotate(35 35 35)'/><path d='M27 43 43 27'/></g>`),
  basket: tile(85, `<g ${S}><path d='M22 40h42l-5 26H27z'/><path d='M30 40a13 13 0 0 1 26 0'/></g>`),
  tag: tile(80, `<g ${S}><path d='M42 22H24v18l24 24 18-18-24-24z'/><circle cx='33' cy='31' r='3.5'/></g>`),
  coin: tile(75, `<g ${S}><circle cx='30' cy='34' r='13'/><circle cx='47' cy='47' r='13'/></g>`),
  chart: tile(75, `<g ${S}><path d='M20 55V38M32 55V26M44 55V44M56 55V32'/><path d='M14 60h48'/></g>`),
  gear: tile(80, `<g ${S}><circle cx='40' cy='40' r='11'/><path d='M40 20v-6M40 66v-6M60 40h6M14 40h6M54 26l4-4M22 58l4-4M54 54l4 4M22 22l4 4'/></g>`),
} as const;

export interface PageTheme {
  key: string;
  icon: string;
  /** Shared brand gradient - identical on every tab. */
  gradient: string;
  /** Tiling motif painted faintly behind the page content. */
  motif: string;
}

function theme(key: string, icon: string, motif: string): PageTheme {
  return { key, icon, gradient: BRAND_GRADIENT, motif };
}

const THEMES: Record<string, PageTheme> = {
  dashboard: theme('dashboard', '🏠', MOTIFS.sprout),
  farms: theme('farms', '🌾', MOTIFS.wheat),
  crops: theme('crops', '🌱', MOTIFS.sprout),
  seasons: theme('seasons', '📅', MOTIFS.calendar),
  activities: theme('activities', '🚜', MOTIFS.tractor),
  expenses: theme('expenses', '💰', MOTIFS.coin),
  irrigation: theme('irrigation', '💧', MOTIFS.droplet),
  sprays: theme('sprays', '🧴', MOTIFS.spray),
  fertilizers: theme('fertilizers', '🧪', MOTIFS.flask),
  seeds: theme('seeds', '🌰', MOTIFS.seed),
  harvest: theme('harvest', '🧺', MOTIFS.basket),
  sales: theme('sales', '🏷️', MOTIFS.tag),
  reports: theme('reports', '📊', MOTIFS.chart),
  settings: theme('settings', '⚙️', MOTIFS.gear),
  search: theme('search', '🔍', MOTIFS.sprout),
  add: theme('add', '➕', MOTIFS.sprout),
  more: theme('more', '☰', MOTIFS.sprout),
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
