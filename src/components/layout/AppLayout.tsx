import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppData } from '../../hooks/useAppData';
import { useAuth } from '../../hooks/useAuth';
import { useSyncStatus } from '../../hooks/usePreferences';
import { flushQueue } from '../../lib/offline/queue';

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
        className="min-h-[44px] rounded-xl border-2 border-brand-700 bg-white px-3 py-1.5 text-base font-semibold text-brand-900
          dark:border-brand-500 dark:bg-slate-900 dark:text-brand-100"
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
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="mb-6 flex items-center gap-2">
          <span aria-hidden="true" className="text-2xl">
            🌿
          </span>
          <span className="text-xl font-bold text-brand-800 dark:text-brand-200">{t('app.name')}</span>
        </div>
        <nav aria-label={t('nav.menu')}>
          <ul className="space-y-1">
            {ALL_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `flex min-h-touch items-center gap-3 rounded-xl px-3 py-2 text-base font-semibold ${
                      isActive
                        ? 'bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <span aria-hidden="true">{link.icon}</span>
                  {t(`nav.${link.key}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center gap-3 px-4 py-2">
            <h1 className="truncate text-lg font-bold lg:text-xl">{title}</h1>
            <div className="ml-auto flex items-center gap-2">
              <SeasonPicker />
            </div>
          </div>
          <div className="px-4 pb-2">
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
              <input
                id="global-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search.placeholder')}
                className="input"
              />
            </form>
          </div>
          <SyncBanner />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 lg:pb-8">
          <Outlet />
        </main>

        <nav
          aria-label={t('nav.menu')}
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:hidden"
        >
          <ul className="flex">
            {PRIMARY.map((link) => (
              <li key={link.to} className="flex-1">
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 py-1 text-xs font-semibold ${
                      isActive ? 'text-brand-800 dark:text-brand-200' : 'text-slate-600 dark:text-slate-400'
                    }`
                  }
                >
                  <span aria-hidden="true" className="text-xl">
                    {link.icon}
                  </span>
                  {t(`nav.${link.key}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <p className="sr-only">{profile?.full_name}</p>
    </div>
  );
}

export { ALL_LINKS };
