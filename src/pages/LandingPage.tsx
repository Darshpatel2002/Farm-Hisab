import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';

/**
 * Public welcome screen shown before sign-in. A calm, agricultural hero with a
 * simple menu so a first-time visitor understands the app before logging in.
 */
export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const goLogin = () => navigate('/login');
  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const features = [
    { icon: '🌾', key: 'farms' },
    { icon: '💰', key: 'money' },
    { icon: '📊', key: 'reports' },
    { icon: '📷', key: 'photos' },
    { icon: '📶', key: 'offline' },
    { icon: '🌐', key: 'language' },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b border-brand-100/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span aria-hidden="true" className="text-2xl">🌿</span>
          <span className="text-lg font-extrabold tracking-tight text-brand-800 dark:text-brand-200">{t('app.name')}</span>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            <button type="button" onClick={() => scrollTo('top')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-800">
              {t('landing.home')}
            </button>
            <button type="button" onClick={() => scrollTo('features')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-800">
              {t('landing.features')}
            </button>
            <button type="button" onClick={goLogin} className="ml-1 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-800">
              {t('landing.signIn')}
            </button>
          </nav>

          <button
            type="button"
            aria-label={t('nav.menu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-auto rounded-lg p-2 text-2xl md:hidden"
          >
            ☰
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-brand-100 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950 md:hidden">
            <button type="button" onClick={() => scrollTo('top')} className="block w-full rounded-lg px-3 py-3 text-left text-base font-semibold">
              {t('landing.home')}
            </button>
            <button type="button" onClick={() => scrollTo('features')} className="block w-full rounded-lg px-3 py-3 text-left text-base font-semibold">
              {t('landing.features')}
            </button>
            <button type="button" onClick={goLogin} className="mt-1 block w-full rounded-xl bg-brand-700 px-3 py-3 text-center text-base font-bold text-white">
              {t('landing.signIn')}
            </button>
          </div>
        ) : null}
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-200 blur-3xl dark:bg-brand-900" />
          <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-amber-200 blur-3xl dark:bg-amber-900/40" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
              🚜 {t('landing.badge')}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-brand-900 dark:text-brand-50 md:text-5xl">
              {t('landing.heroTitle')}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-slate-700 dark:text-slate-300">{t('landing.heroSubtitle')}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={goLogin} className="min-h-[56px] rounded-2xl bg-brand-700 px-7 text-lg font-bold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800">
                {t('landing.getStarted')}
              </button>
              <button type="button" onClick={() => scrollTo('features')} className="min-h-[56px] rounded-2xl border-2 border-brand-700 px-7 text-lg font-bold text-brand-800 transition hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-slate-800">
                {t('landing.learnMore')}
              </button>
            </div>

            <div className="mt-6 flex gap-2">
              {SUPPORTED_LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => setLanguage(language.code)}
                  aria-pressed={i18n.language === language.code}
                  className={`min-h-[40px] rounded-xl px-4 text-sm font-semibold ${
                    i18n.language === language.code ? 'bg-brand-700 text-white' : 'bg-white text-brand-800 ring-1 ring-brand-200 dark:bg-slate-900 dark:text-brand-200'
                  }`}
                >
                  {language.label}
                </button>
              ))}
            </div>
          </div>

          {/* Illustrated card */}
          <div className="relative">
            <div className="mx-auto max-w-sm rounded-3xl border border-brand-100 bg-white p-6 shadow-2xl shadow-brand-900/10 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-4xl">🌱</span>
                <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100">Kharif 2026</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">{t('dashboard.netProfit')}</p>
              <p className="text-3xl font-extrabold text-brand-800 dark:text-brand-200">₹ 2,45,000</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-brand-50 p-3 dark:bg-slate-800">
                  <p className="text-lg font-bold">12</p>
                  <p className="text-xs text-slate-500">{t('dashboard.totalFarms')}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 dark:bg-slate-800">
                  <p className="text-lg font-bold">8</p>
                  <p className="text-xs text-slate-500">{t('dashboard.activeCrops')}</p>
                </div>
                <div className="rounded-xl bg-brand-50 p-3 dark:bg-slate-800">
                  <p className="text-lg font-bold">96q</p>
                  <p className="text-xs text-slate-500">{t('reports.yield')}</p>
                </div>
              </div>
              <div className="mt-4 flex items-end gap-1.5" aria-hidden="true">
                {[40, 65, 50, 80, 60, 92, 70].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-brand-300 to-brand-600" style={{ height: `${h}px` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-3xl font-extrabold text-brand-900 dark:text-brand-50">{t('landing.featuresTitle')}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-slate-600 dark:text-slate-300">{t('landing.featuresSubtitle')}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.key} className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <span className="text-3xl">{feature.icon}</span>
              <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">{t(`landing.feature.${feature.key}.title`)}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t(`landing.feature.${feature.key}.body`)}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-gradient-to-r from-brand-700 to-brand-600 p-8 text-center text-white shadow-xl">
          <h3 className="text-2xl font-extrabold">{t('landing.ctaTitle')}</h3>
          <p className="mx-auto mt-2 max-w-xl text-brand-50">{t('landing.ctaSubtitle')}</p>
          <button type="button" onClick={goLogin} className="mt-6 min-h-[56px] rounded-2xl bg-white px-8 text-lg font-bold text-brand-800 shadow-lg transition hover:bg-brand-50">
            {t('landing.getStarted')}
          </button>
        </div>
      </section>

      <footer className="border-t border-brand-100 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        🌿 {t('app.name')} · {t('landing.footer')}
      </footer>
    </div>
  );
}
