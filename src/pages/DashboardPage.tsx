import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChartCard, PieChartCard } from '../components/charts/Charts';
import { Card, EmptyState, LoadingBlock, SectionTitle, StatCard, TrendValue } from '../components/ui/Layout';
import { useAppData } from '../hooks/useAppData';
import { useSeasonReport } from '../features/reports/useSeasonReport';
import { rankBy } from '../lib/calculations/ranking';
import { formatCurrency, formatNumber } from '../lib/formatting/number';
import { SCENES } from '../components/layout/scenery';

const QUICK_ACTIONS = [
  { to: '/expenses', key: 'expenses.add', icon: '💰', gradient: 'from-rose-500 to-red-700' },
  { to: '/sprays', key: 'sprays.add', icon: '🧴', gradient: 'from-violet-500 to-purple-700' },
  { to: '/irrigation', key: 'irrigation.add', icon: '💧', gradient: 'from-sky-500 to-blue-700' },
  { to: '/harvest', key: 'harvest.add', icon: '🧺', gradient: 'from-orange-500 to-amber-700' },
  { to: '/sales', key: 'sales.add', icon: '🏷️', gradient: 'from-fuchsia-500 to-purple-700' },
  { to: '/activities', key: 'activities.add', icon: '🚜', gradient: 'from-amber-500 to-orange-700' },
] as const;

/** Medal colours for the top three, muted slate for the rest. */
const RANK_TONES = [
  'bg-amber-100 text-amber-800',
  'bg-slate-200 text-slate-700',
  'bg-orange-100 text-orange-800',
  'bg-slate-100 text-slate-600',
] as const;

/** Fades the brand wash out towards the right so the artwork stays visible. */
const SCRIM = {
  maskImage: 'linear-gradient(to right, black 0%, black 42%, transparent 95%)',
  WebkitMaskImage: 'linear-gradient(to right, black 0%, black 42%, transparent 95%)',
} as const;

export default function DashboardPage() {
  const { t } = useTranslation();
  const { season, seasonId, farms, cropName } = useAppData();
  const { report, isLoading } = useSeasonReport(seasonId);

  const profitByFarm = useMemo(
    () =>
      rankBy(report.byFarm, 'profit', 8).map((entry) => ({ name: entry.item.name, value: entry.item.profit })),
    [report.byFarm],
  );
  const profitByCrop = useMemo(
    () => rankBy(report.byCrop, 'profit', 8).map((entry) => ({ name: cropName(entry.item.cropId) || entry.item.name, value: entry.item.profit })),
    [report.byCrop, cropName],
  );
  const expenseByCategory = useMemo(
    () => report.byCategory.slice(0, 8).map((c) => ({ name: t(`categories.${c.category}`), value: c.amount })),
    [report.byCategory, t],
  );
  const revenueByCrop = useMemo(
    () =>
      rankBy(report.byCrop, 'revenue', 8)
        .filter((entry) => entry.item.revenue > 0)
        .map((entry) => ({ name: cropName(entry.item.cropId) || entry.item.name, value: entry.item.revenue })),
    [report.byCrop, cropName],
  );
  const yieldByCrop = useMemo(
    () =>
      rankBy(report.byCrop, 'yieldPerAcre', 8)
        .filter((entry) => entry.item.yieldQuintal > 0)
        .map((entry) => ({ name: cropName(entry.item.cropId) || entry.item.name, value: entry.item.yieldQuintal })),
    [report.byCrop, cropName],
  );

  if (farms.length === 0 && !isLoading) {
    return (
      <section>
        <div className="relative overflow-hidden rounded-3xl text-white shadow-card">
          <span aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: SCENES.dashboard }} />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 opacity-90" style={SCRIM} />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="relative p-8">
            <span aria-hidden="true" className="mb-3 inline-block animate-float text-6xl drop-shadow">🌱</span>
            <h2 className="text-3xl font-extrabold tracking-tight drop-shadow">{t('onboarding.welcome')}</h2>
            <p className="mt-2 max-w-lg text-lg text-white/90">{t('onboarding.intro')}</p>

            <ol className="mt-6 grid gap-2 sm:grid-cols-2">
              {['step1', 'step2', 'step3', 'step4', 'step5'].map((step, index) => (
                <li key={step} className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-sm font-extrabold">
                    {index + 1}
                  </span>
                  <span className="font-semibold">{t(`onboarding.${step}`)}</span>
                </li>
              ))}
            </ol>

            <Link
              to="/farms"
              className="mt-7 inline-flex min-h-[56px] items-center rounded-2xl bg-white px-8 text-lg font-extrabold text-brand-700 shadow-lift transition hover:-translate-y-0.5"
            >
              {t('onboarding.start')}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading) return <LoadingBlock label={t('app.loading')} />;
  if (!seasonId) return <EmptyState message={t('seasons.empty')} actionLabel={t('seasons.emptyAction')} to="/seasons" />;

  const totals = report.totals;

  return (
    <section>
      {/* Season hero - the anchor for the whole screen. */}
      <div className="relative mb-6 overflow-hidden rounded-3xl shadow-card">
        <span aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: SCENES.dashboard }} />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 opacity-90" style={SCRIM} />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <span aria-hidden="true" className="absolute right-8 top-8 hidden animate-float text-6xl drop-shadow-lg sm:block">🌾</span>

        <div className="relative p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-widest text-white/70">{t('dashboard.currentSeason')}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {season?.name ?? t('dashboard.noSeason')}
          </h1>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">{t('dashboard.totalInvestment')}</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{formatCurrency(totals.cost)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">{t('dashboard.actualRevenue')}</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{formatCurrency(totals.revenue)}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('dashboard.netProfit')}</p>
              <p className={`mt-1 text-2xl font-extrabold ${totals.profit >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                {formatCurrency(totals.profit)}
              </p>
              <p className="text-xs font-bold text-slate-500">
                {t('reports.roiShort')}: {formatNumber(totals.roi, 1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('dashboard.totalFarms')} value={formatNumber(totals.farmCount, 0)} />
        <StatCard label={t('dashboard.totalArea')} value={`${formatNumber(totals.acres, 2)} ${t('common.acres')}`} />
        <StatCard label={t('dashboard.activeCrops')} value={formatNumber(totals.cropCount, 0)} />
        <StatCard label={t('dashboard.outstanding')} value={formatCurrency(totals.outstandingRevenue)} />
      </div>

      <Card className="mb-6">
        <SectionTitle title={t('dashboard.quickAdd')} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={`group flex min-h-[76px] items-center gap-3 rounded-2xl bg-gradient-to-br ${action.gradient} px-4 py-3 text-base font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift`}
            >
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-2xl">
                {action.icon}
              </span>
              <span className="leading-tight">{t(action.key)}</span>
            </Link>
          ))}
        </div>
      </Card>

      {totals.unallocatedCost > 0.01 ? (
        <Card className="mb-6 border-l-4 border-l-amber-500">
          <p className="text-base font-bold">
            ⚠️ {t('dashboard.unallocated')}: {formatCurrency(totals.unallocatedCost)}
          </p>
        </Card>
      ) : null}

      <BarChartCard title={t('dashboard.profitByFarm')} data={profitByFarm} />
      <BarChartCard title={t('dashboard.profitByCrop')} data={profitByCrop} />
      <PieChartCard title={t('dashboard.expenseBreakdown')} data={expenseByCategory} />
      <BarChartCard title={t('dashboard.revenueBreakdown')} data={revenueByCrop} />
      <BarChartCard title={t('dashboard.yieldByCrop')} data={yieldByCrop} currency={false} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title={t('dashboard.topFarms')} />
          <ol className="space-y-2">
            {rankBy(report.byFarm, 'profit', 5).map((entry) => (
              <li key={entry.item.farmId}>
                <Link
                  to={`/farms/${entry.item.farmId}`}
                  className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-brand-50 dark:hover:bg-slate-800/70"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${RANK_TONES[entry.rank - 1] ?? RANK_TONES[3]}`}>
                      {entry.rank}
                    </span>
                    <span className="truncate text-base font-bold">{entry.item.name}</span>
                  </span>
                  <TrendValue value={entry.item.profit} formatted={formatCurrency(entry.item.profit)} />
                </Link>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <SectionTitle title={t('dashboard.topCrops')} />
          <ol className="space-y-2">
            {rankBy(report.byCrop, 'profitPerAcre', 5).map((entry) => (
              <li key={entry.item.cropId} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${RANK_TONES[entry.rank - 1] ?? RANK_TONES[3]}`}>
                    {entry.rank}
                  </span>
                  <span className="truncate text-base font-bold">{cropName(entry.item.cropId) || entry.item.name}</span>
                </span>
                <TrendValue value={entry.item.profitPerAcre} formatted={formatCurrency(entry.item.profitPerAcre)} />
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </section>
  );
}
