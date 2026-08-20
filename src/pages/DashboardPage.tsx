import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChartCard, PieChartCard } from '../components/charts/Charts';
import { Card, EmptyState, LoadingBlock, SectionTitle, StatCard, TrendValue } from '../components/ui/Layout';
import { useAppData } from '../hooks/useAppData';
import { useSeasonReport } from '../features/reports/useSeasonReport';
import { rankBy } from '../lib/calculations/ranking';
import { formatCurrency, formatNumber } from '../lib/formatting/number';

const QUICK_ACTIONS = [
  { to: '/expenses', key: 'expenses.add', icon: '💰' },
  { to: '/sprays', key: 'sprays.add', icon: '🧴' },
  { to: '/irrigation', key: 'irrigation.add', icon: '💧' },
  { to: '/harvest', key: 'harvest.add', icon: '🧺' },
  { to: '/sales', key: 'sales.add', icon: '🏷️' },
  { to: '/activities', key: 'activities.add', icon: '🚜' },
] as const;

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
        <Card className="mb-4">
          <h2 className="text-xl font-bold">{t('onboarding.welcome')}</h2>
          <p className="mt-1 text-base text-slate-700 dark:text-slate-300">{t('onboarding.intro')}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-base">
            <li>{t('onboarding.step1')}</li>
            <li>{t('onboarding.step2')}</li>
            <li>{t('onboarding.step3')}</li>
            <li>{t('onboarding.step4')}</li>
            <li>{t('onboarding.step5')}</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/farms" className="min-h-touch rounded-xl bg-brand-700 px-5 py-3 text-base font-semibold text-white">
              {t('onboarding.start')}
            </Link>
            <Link
              to="/settings"
              className="min-h-touch rounded-xl border-2 border-brand-700 px-5 py-3 text-base font-semibold text-brand-800 dark:text-brand-200"
            >
              {t('onboarding.loadDemo')}
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  if (isLoading) return <LoadingBlock label={t('app.loading')} />;
  if (!seasonId) return <EmptyState message={t('seasons.empty')} actionLabel={t('seasons.emptyAction')} to="/seasons" />;

  const totals = report.totals;

  return (
    <section>
      <Card className="mb-4">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t('dashboard.currentSeason')}</p>
        <p className="text-2xl font-bold text-brand-800 dark:text-brand-200">{season?.name ?? t('dashboard.noSeason')}</p>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('dashboard.totalFarms')} value={formatNumber(totals.farmCount, 0)} />
        <StatCard label={t('dashboard.totalArea')} value={`${formatNumber(totals.acres, 2)} ${t('common.acres')}`} />
        <StatCard label={t('dashboard.activeCrops')} value={formatNumber(totals.cropCount, 0)} />
        <StatCard label={t('dashboard.totalInvestment')} value={formatCurrency(totals.cost)} />
        <StatCard label={t('dashboard.actualRevenue')} value={formatCurrency(totals.revenue)} />
        <StatCard label={t('dashboard.expectedRevenue')} value={formatCurrency(totals.expectedRevenue)} />
        <StatCard
          label={t('dashboard.netProfit')}
          value={formatCurrency(totals.profit)}
          tone={totals.profit >= 0 ? 'good' : 'bad'}
          hint={`${t('reports.roiShort')}: ${formatNumber(totals.roi, 1)}%`}
        />
        <StatCard label={t('dashboard.outstanding')} value={formatCurrency(totals.outstandingRevenue)} />
      </div>

      <Card className="mb-4">
        <SectionTitle title={t('dashboard.quickAdd')} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex min-h-[64px] items-center gap-2 rounded-2xl bg-brand-700 px-3 py-3 text-base font-semibold text-white hover:bg-brand-800"
            >
              <span aria-hidden="true" className="text-2xl">
                {action.icon}
              </span>
              {t(action.key)}
            </Link>
          ))}
        </div>
      </Card>

      {totals.unallocatedCost > 0.01 ? (
        <Card className="mb-4">
          <p className="text-base font-semibold">
            {t('dashboard.unallocated')}: {formatCurrency(totals.unallocatedCost)}
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
              <li key={entry.item.farmId} className="flex items-center justify-between gap-3">
                <Link to={`/farms/${entry.item.farmId}`} className="text-base font-semibold underline">
                  {entry.rank}. {entry.item.name}
                </Link>
                <TrendValue value={entry.item.profit} formatted={formatCurrency(entry.item.profit)} />
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <SectionTitle title={t('dashboard.topCrops')} />
          <ol className="space-y-2">
            {rankBy(report.byCrop, 'profitPerAcre', 5).map((entry) => (
              <li key={entry.item.cropId} className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold">
                  {entry.rank}. {cropName(entry.item.cropId) || entry.item.name}
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
