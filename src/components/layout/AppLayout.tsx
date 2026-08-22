import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppData } from '../../hooks/useAppData';
import { useAuth } from '../../hooks/useAuth';
import { useSyncStatus } from '../../hooks/usePreferences';
import { flushQueue } from '../../lib/offline/queue';
import { ExitGuard } from './ExitGuard';

/**
 * Desktop: sidebar navigation.
 * Mobile: bottom bar with the five most used destinations.
 */

const PRIMARY = [
  { to: '/', key: 'dashboard', icon: '🏠', end: true },
  { to: '/farms', key: 'farms', icon: '🌾', end: false },
  { to: '/add', key: 'add', icon: '➕', end: false },
  { to: '/reports', key: 'reports', icon: '📊', end: false },
  { to: '/more', key: 'more', icon: '☰', end: false },
] as const;

const ALL_LINKS = [
  { to: '/', key: 'dashboard', icon: '🏠' },
  { to: '/farms', key: 'farms', icon: '🌾' },
  { to: '/crops', key: 'crops', icon: '🌱' },
  { to: '/seasons', key: 'seasons', icon: '📅' },
  { to: '/activities', key: 'activities', icon: '🚜' },
  { to: '/expenses', key: 'expenses', icon: '💰' },
  { to: '/irrigation', key: 'irrigation', icon: '💧' },
  { to: '/sprays', key: 'sprays', icon: '🧴' },
  { to: '/fertilizers', key: 'fertilizers', icon: '🧪' },
  { to: '/seeds', key: 'seeds', icon: '🌰' },
  { to: '/harvest', key: 'harvest', icon: '🧺' },
  { to: '/sales', key: 'sales', icon: '🏷️' },
  { to: '/reports', key: 'reports', icon: '📊' },
  { to: '/settings', key: 'settings', icon: '⚙️' },
] as const;

export function SyncBanner() {
  const { t } = useTranslation();
  const status = useSyncStatus();

  // Nothing to say while everything is up to date.
  if (status.state === 'idle') return null;
  if (status.state === 'synced' && status.pending === 0) return null;

  const tone =
    status.state === 'offline'
      ? 'bg-soil-200 text-soil-700'
      : status.state === 'error'
        ? 'bg-red-100 text-red-900'
        : 'bg-brand-100 text-brand-900';

  const message =
    status.state === 'offline'
      ? t('offline.offline')
      : status.state === 'syncing'
        ? t('offline.syncing')
        : status.state === 'error'
          ? t('offline.error')
          : t('offline.synced');

  return (
    <div role="status" aria-live="polite" className={`px-4 py-2 text-center text-sm font-semibold ${tone}`}>
      {message}
      {status.pending > 0 ? ` (${status.pending})` : ''}
      {status.state === 'error' ? (
        <button type="button" onClick={() => void flushQueue()} className="ml-2 underline">
          {t('settings.syncNow')}
        </button>
      ) : null}
    </div>
  );
}

function SeasonPicker() {
  const { t } = useTranslation();
  const { seasons, seasonId, setSeasonId } = useAppData();
  if (seasons.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <span className="sr-only">{t('common.season')}</span>
      <select
        value={seasonId ?? ''}
        onChange={(e) => setSeasonId(e.target.value)}
        className="min-h-[44px] rounded-2xl border-2 border-brand-500/70 bg-white/90 px-3 py-1.5 text-base font-bold text-brand-800 shadow-sm
          dark:border-brand-500/60 dark:bg-slate-900/80 dark:text-brand-100"
      >
        {seasons.map((season) => (
          <option key={season.id} value={season.id}>
            {season.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');

  const title = useMemo(() => {
    const link = ALL_LINKS.find((l) => l.to !== '/' && location.pathname.startsWith(l.to));
    return link ? t(`nav.${link.key}`) : t('app.name');
  }, [location.pathname, t]);

  return (
    <div className="min-h-screen lg:flex">
      <ExitGuard />
      <aside className="glass hidden w-72 shrink-0 flex-col border-r p-4 lg:flex">
        <div className="mb-7 flex items-center gap-3 px-1">
          <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-2xl shadow-soft">
            🌿
          </span>
          <div className="leading-tight">
            <span className="block text-xl font-extrabold tracking-tight text-brand-800 dark:text-brand-200">{t('app.name')}</span>
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">{t('app.tagline')}</span>
          </div>
        </div>
        <nav aria-label={t('nav.menu')} className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {ALL_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `group flex min-h-touch items-center gap-3 rounded-2xl px-3 py-2.5 text-base font-bold transition ${
                      isActive
                        ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-soft'
                        : 'text-slate-700 hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-slate-800/70'
                    }`
                  }
                >
                  <span aria-hidden="true" className="text-xl">{link.icon}</span>
                  {t(`nav.${link.key}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {profile?.full_name ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-3 dark:border-slate-700/50 dark:bg-slate-800/50">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
              {profile.full_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{profile.full_name}</span>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 lg:text-2xl">{title}</h1>
            <div className="ml-auto flex items-center gap-2">
              <SeasonPicker />
            </div>
          </div>
          <div className="px-4 pb-3">
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/search?q=${encodeURIComponent(search)}`);
              }}
            >
              <label className="sr-only" htmlFor="global-search">
                {t('search.title')}
              </label>
              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                  🔍
                </span>
                <input
                  id="global-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('search.placeholder')}
                  className="input pl-11"
                />
              </div>
            </form>
          </div>
          <SyncBanner />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-5 lg:pb-10">
          <div key={location.pathname} className="animate-fade-up">
            <Outlet />
          </div>
        </main>

        <nav
          aria-label={t('nav.menu')}
          className="safe-bottom glass fixed inset-x-0 bottom-0 z-40 border-t lg:hidden"
        >
          <ul className="mx-auto flex max-w-lg items-end justify-around px-2">
            {PRIMARY.map((link) =>
              link.key === 'add' ? (
                <li key={link.to} className="flex-1">
                  <NavLink
                    to={link.to}
                    end={link.end}
                    aria-label={t(`nav.${link.key}`)}
                    className="mx-auto -mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-brand-gradient text-3xl font-bold text-white shadow-lift ring-4 ring-white dark:ring-slate-900"
                  >
                    <span aria-hidden="true">＋</span>
                  </NavLink>
                </li>
              ) : (
                <li key={link.to} className="flex-1">
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `mx-auto flex min-h-[58px] max-w-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-xs font-bold transition ${
                        isActive
                          ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200'
                          : 'text-slate-500 dark:text-slate-400'
                      }`
                    }
                  >
                    <span aria-hidden="true" className="text-xl">
                      {link.icon}
                    </span>
                    {t(`nav.${link.key}`)}
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export { ALL_LINKS };
