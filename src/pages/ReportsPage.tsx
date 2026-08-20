import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChartCard, ComboBarCard, EffortScatterCard, LineChartCard, PieChartCard } from '../components/charts/Charts';
import { Card, EmptyState, LoadingBlock, PageHeader, SectionTitle, StatCard, TrendValue } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { SelectField, TextField } from '../components/ui/Field';
import { enumOptions } from '../components/records/Selectors';
import { useAppData } from '../hooks/useAppData';
import { usePersistedFilters } from '../hooks/usePreferences';
import { useSeasonReport, type ReportFilters } from '../features/reports/useSeasonReport';
import {
  analyseBestCrops,
  compareYears,
  cropRankings,
  effortVsProfit,
  farmRankings,
  performanceScores,
  rankBy,
} from '../lib/calculations/ranking';
import { formatCurrency, formatNumber, safeDivide } from '../lib/formatting/number';
import { formatDate, formatMonthLabel } from '../lib/formatting/date';
import { downloadCsv, timestampedName } from '../lib/export/files';
import { EXPENSE_CATEGORIES } from '../types/db';
import type { CoreMetrics, CropReport, FarmReport } from '../lib/calculations/profit';

type Tab =
  | 'summary'
  | 'costRevenue'
  | 'farms'
  | 'crops'
  | 'best'
  | 'effort'
  | 'compare'
  | 'yoy'
  | 'expenses'
  | 'cashflow'
  | 'sales';

const TABS: Array<{ id: Tab; labelKey: string }> = [
  { id: 'summary', labelKey: 'reports.seasonSummary' },
  { id: 'costRevenue', labelKey: 'reports.costVsRevenue' },
  { id: 'farms', labelKey: 'reports.farmRanking' },
  { id: 'crops', labelKey: 'reports.cropRanking' },
  { id: 'best', labelKey: 'reports.bestCrops' },
  { id: 'effort', labelKey: 'reports.effortVsProfit' },
  { id: 'compare', labelKey: 'reports.farmComparison' },
  { id: 'yoy', labelKey: 'reports.yearOverYear' },
  { id: 'expenses', labelKey: 'reports.expenseReport' },
  { id: 'cashflow', labelKey: 'reports.cashFlow' },
  { id: 'sales', labelKey: 'reports.saleReport' },
];

const EMPTY_FILTERS: ReportFilters = { farmId: '', cropId: '', dateFrom: '', dateTo: '', category: '' };

export default function ReportsPage() {
  const { t } = useTranslation();
  const { seasonId, seasons, season, farms, cropName } = useAppData();
  const [tab, setTab] = useState<Tab>('summary');
  const { filters, setFilters, reset } = usePersistedFilters<ReportFilters>('reports', EMPTY_FILTERS);
  const [draft, setDraft] = useState<ReportFilters>(filters);
  const [compareSeasonId, setCompareSeasonId] = useState<string>('');

  const { report, dataset, isLoading } = useSeasonReport(seasonId, filters);
  const previous = useSeasonReport(compareSeasonId || null);

  const cropLabel = (crop: { cropId: string; name: string }) => cropName(crop.cropId) || crop.name;

  const farmRanks = useMemo(() => farmRankings(report.byFarm), [report.byFarm]);
  const cropRanks = useMemo(() => cropRankings(report.byCrop), [report.byCrop]);
  const best = useMemo(() => analyseBestCrops(report.byCrop), [report.byCrop]);
  const effort = useMemo(() => effortVsProfit(report.byCrop), [report.byCrop]);

  if (isLoading) return <LoadingBlock label={t('app.loading')} />;
  if (!seasonId) return <EmptyState message={t('seasons.empty')} actionLabel={t('seasons.emptyAction')} to="/seasons" />;

  return (
    <section>
      <PageHeader title={t('reports.title')} subtitle={season?.name} />

      <Card className="mb-4">
        <SectionTitle title={t('common.filters')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label={t('common.farm')}
            value={draft.farmId ?? ''}
            placeholder={t('common.all')}
            options={farms.map((f) => ({ value: f.id, label: f.name }))}
            onChange={(e) => setDraft({ ...draft, farmId: e.target.value })}
          />
          <SelectField
            label={t('common.crop')}
            value={draft.cropId ?? ''}
            placeholder={t('common.all')}
            options={report.byCrop.map((c) => ({ value: c.cropId, label: cropLabel(c) }))}
            onChange={(e) => setDraft({ ...draft, cropId: e.target.value })}
          />
          <TextField
            label={t('common.from')}
            type="date"
            value={draft.dateFrom ?? ''}
            onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })}
          />
          <TextField
            label={t('common.to')}
            type="date"
            value={draft.dateTo ?? ''}
            onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })}
          />
          <SelectField
            label={t('common.category')}
            value={draft.category ?? ''}
            placeholder={t('common.all')}
            options={enumOptions(t, 'categories', EXPENSE_CATEGORIES)}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setFilters(draft)}>{t('common.apply')}</Button>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              setDraft(EMPTY_FILTERS);
            }}
          >
            {t('common.reset')}
          </Button>
        </div>
      </Card>

      <nav aria-label={t('reports.title')} className="mb-4 -mx-1 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-touch shrink-0 rounded-xl px-4 py-2 text-base font-semibold ${
              tab === item.id
                ? 'bg-brand-700 text-white'
                : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      {tab === 'summary' ? <SummaryTab report={report} cropLabel={cropLabel} /> : null}
      {tab === 'costRevenue' ? <CostRevenueTab report={report} cropLabel={cropLabel} /> : null}
      {tab === 'farms' ? <RankingTab title={t('reports.farmRanking')} ranks={farmRanks} labelOf={(f: FarmReport) => f.name} /> : null}
      {tab === 'crops' ? <RankingTab title={t('reports.cropRanking')} ranks={cropRanks} labelOf={cropLabel} /> : null}
      {tab === 'best' ? <BestCropsTab best={best} cropLabel={cropLabel} /> : null}
      {tab === 'effort' ? (
        <EffortScatterCard
          title={t('reports.effortVsProfit')}
          effortMedian={effort.effortMedian}
          profitMedian={effort.profitMedian}
          data={effort.points.map((point) => ({
            name: cropLabel(point.item),
            effort: point.effort,
            profit: point.profitPerAcre,
            quadrant: point.quadrant,
          }))}
        />
      ) : null}
      {tab === 'compare' ? <ComparisonTab farms={report.byFarm} crops={report.byCrop} cropLabel={cropLabel} /> : null}
      {tab === 'yoy' ? (
        <Card>
          <SectionTitle title={t('reports.yearOverYear')} />
          <SelectField
            label={t('reports.compareWith')}
            value={compareSeasonId}
            placeholder={t('common.select')}
            options={seasons.filter((s) => s.id !== seasonId).map((s) => ({ value: s.id, label: s.name }))}
            onChange={(e) => setCompareSeasonId(e.target.value)}
          />
          {compareSeasonId ? (
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th scope="col" className="py-2">{t('common.total')}</th>
                  <th scope="col" className="py-2 text-right">{previous.report.totals ? t('reports.cost') : ''}</th>
                  <th scope="col" className="py-2 text-right">{season?.name}</th>
                  <th scope="col" className="py-2 text-right">{t('reports.change')}</th>
                </tr>
              </thead>
              <tbody>
                {compareYears(previous.report.totals, report.totals, [
                  { key: 'cost', label: t('reports.cost') },
                  { key: 'revenue', label: t('reports.revenue') },
                  { key: 'profit', label: t('reports.profit') },
                  { key: 'profitPerAcre', label: t('reports.profitPerAcre') },
                  { key: 'roi', label: t('reports.roiShort') },
                  { key: 'yieldPerAcre', label: t('reports.yieldPerAcre') },
                ]).map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 dark:border-slate-800">
                    <th scope="row" className="py-2 font-semibold">{row.label}</th>
                    <td className="py-2 text-right">{formatNumber(row.previous, 1)}</td>
                    <td className="py-2 text-right">{formatNumber(row.current, 1)}</td>
                    <td className="py-2 text-right">
                      <TrendValue value={row.change} formatted={`${formatNumber(row.changePercent, 1)}%`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-base text-slate-600 dark:text-slate-400">{t('reports.selectAtLeastTwo')}</p>
          )}
        </Card>
      ) : null}
      {tab === 'expenses' ? (
        <>
          <Card className="mb-4">
            <SectionTitle
              title={t('reports.expenseReport')}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadCsv(
                      timestampedName('expenses', 'csv'),
                      dataset.expenses.map((e) => ({
                        date: e.date,
                        category: e.category,
                        description: e.description,
                        amount: e.amount,
                        farm: e.farm_id ? (farms.find((f) => f.id === e.farm_id)?.name ?? '') : 'shared',
                        vendor: e.vendor ?? '',
                        payment_method: e.payment_method,
                        source: e.source_type,
                      })),
                    )
                  }
                >
                  {t('reports.downloadCsv')}
                </Button>
              }
            />
            <p className="text-2xl font-bold">{formatCurrency(report.totals.cost)}</p>
            <ul className="mt-3 space-y-1">
              {report.byCategory.map((row) => (
                <li key={row.category} className="flex justify-between gap-3 text-base">
                  <span>{t(`categories.${row.category}`)}</span>
                  <span className="font-semibold">
                    {formatCurrency(row.amount)} ({formatNumber(row.share, 1)}%)
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <PieChartCard
            title={t('dashboard.expenseBreakdown')}
            data={report.byCategory.map((c) => ({ name: t(`categories.${c.category}`), value: c.amount }))}
          />
        </>
      ) : null}
      {tab === 'cashflow' ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <StatCard label={t('reports.moneySpent')} value={formatCurrency(report.totals.cost)} />
            <StatCard label={t('reports.moneyReceived')} value={formatCurrency(report.totals.revenue)} />
            <StatCard label={t('reports.outstandingSales')} value={formatCurrency(report.totals.outstandingRevenue)} />
            <StatCard
              label={t('reports.profit')}
              value={formatCurrency(report.totals.profit)}
              tone={report.totals.profit >= 0 ? 'good' : 'bad'}
            />
          </div>
          <ComboBarCard
            title={t('reports.cashFlow')}
            firstLabel={t('reports.moneySpent')}
            secondLabel={t('reports.moneyReceived')}
            data={report.monthly.map((m) => ({ name: formatMonthLabel(m.month), value: m.spent, secondary: m.received }))}
          />
          <LineChartCard
            title={t('reports.cumulative')}
            firstLabel={t('reports.moneySpent')}
            secondLabel={t('reports.moneyReceived')}
            data={report.monthly.map((m) => ({
              name: formatMonthLabel(m.month),
              value: m.cumulativeSpent,
              secondary: m.cumulativeReceived,
            }))}
          />
        </>
      ) : null}
      {tab === 'sales' ? (
        <Card>
          <SectionTitle
            title={t('reports.saleReport')}
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadCsv(
                    timestampedName('sales', 'csv'),
                    dataset.sales.map((s) => ({
                      date: s.date,
                      buyer: s.buyer,
                      crop: cropName(s.crop_id),
                      quantity: s.quantity,
                      unit: s.unit,
                      price_per_unit: s.price_per_unit,
                      gross_amount: s.gross_amount,
                      deductions: s.transport_cost + s.commission + s.other_deductions,
                      net_amount: s.net_amount,
                      payment_status: s.payment_status,
                    })),
                  )
                }
              >
                {t('reports.downloadCsv')}
              </Button>
            }
          />
          {dataset.sales.length === 0 ? (
            <p className="py-4 text-base text-slate-600 dark:text-slate-400">{t('sales.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-base">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th scope="col" className="py-2">{t('common.date')}</th>
                    <th scope="col" className="py-2">{t('common.crop')}</th>
                    <th scope="col" className="py-2 text-right">{t('sales.quantitySold')}</th>
                    <th scope="col" className="py-2 text-right">{t('sales.averagePrice')}</th>
                    <th scope="col" className="py-2 text-right">{t('sales.netRevenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{formatDate(sale.date)}</td>
                      <td className="py-2">{cropName(sale.crop_id) || sale.buyer}</td>
                      <td className="py-2 text-right">
                        {formatNumber(sale.quantity, 2)} {sale.unit}
                      </td>
                      <td className="py-2 text-right">{formatCurrency(sale.price_per_unit)}</td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(sale.net_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </section>
  );
}

function SummaryTab({
  report,
  cropLabel,
}: {
  report: ReturnType<typeof useSeasonReport>['report'];
  cropLabel: (crop: CropReport) => string;
}) {
  const { t } = useTranslation();
  const totals = report.totals;
  const bestFarm = rankBy(report.byFarm, 'profit', 1)[0]?.item ?? null;
  const bestCrop = rankBy(report.byCrop, 'profitPerAcre', 1)[0]?.item ?? null;
  const worstCrop = [...report.byCrop].sort((a, b) => a.profitPerAcre - b.profitPerAcre)[0] ?? null;
  const costliestCrop = rankBy(report.byCrop, 'cost', 1)[0]?.item ?? null;
  const highestYield = rankBy(report.byCrop, 'yieldPerAcre', 1)[0]?.item ?? null;

  const costComparison =
    bestCrop && costliestCrop && bestCrop.cropId !== costliestCrop.cropId && bestCrop.costPerAcre > 0
      ? t('reports.interpretationCostCompare', {
          cropA: cropLabel(costliestCrop),
          cropB: cropLabel(bestCrop),
          percent: `${formatNumber(
            safeDivide(costliestCrop.costPerAcre - bestCrop.costPerAcre, bestCrop.costPerAcre) * 100,
            0,
          )}%`,
        })
      : null;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('dashboard.totalArea')} value={`${formatNumber(totals.acres, 2)} ${t('common.acres')}`} />
        <StatCard label={t('dashboard.totalInvestment')} value={formatCurrency(totals.cost)} />
        <StatCard label={t('dashboard.totalRevenue')} value={formatCurrency(totals.revenue)} />
        <StatCard
          label={t('dashboard.netProfit')}
          value={formatCurrency(totals.profit)}
          tone={totals.profit >= 0 ? 'good' : 'bad'}
        />
        <StatCard label={t('reports.roiShort')} value={`${formatNumber(totals.roi, 1)}%`} />
        <StatCard label={t('reports.costPerAcre')} value={formatCurrency(totals.costPerAcre)} />
        <StatCard label={t('reports.profitPerAcre')} value={formatCurrency(totals.profitPerAcre)} />
        <StatCard
          label={t('reports.yieldPerAcre')}
          value={`${formatNumber(totals.yieldPerAcre, 2)} ${t('common.quintal')}`}
        />
      </div>

      <Card className="mb-4">
        <SectionTitle title={t('reports.seasonSummary')} />
        {totals.revenue === 0 && totals.cost > 0 ? (
          <p className="mb-3 rounded-xl bg-soil-100 p-3 text-base font-semibold text-soil-700">
            {t('reports.seasonInProgress')}
          </p>
        ) : null}
        <ul className="space-y-1 text-base">
          <li>
            <strong>{t('reports.bestFarm')}:</strong> {bestFarm ? `${bestFarm.name} — ${formatCurrency(bestFarm.profit)}` : t('common.noData')}
          </li>
          <li>
            <strong>{t('reports.bestCrop')}:</strong>{' '}
            {bestCrop ? `${cropLabel(bestCrop)} — ${formatCurrency(bestCrop.profitPerAcre)} / ${t('common.acres')}` : t('common.noData')}
          </li>
          <li>
            <strong>{t('reports.worstCrop')}:</strong> {worstCrop ? cropLabel(worstCrop) : t('common.noData')}
          </li>
          <li>
            <strong>{t('reports.highestYield')}:</strong>{' '}
            {highestYield ? `${cropLabel(highestYield)} — ${formatNumber(highestYield.yieldPerAcre, 2)} ${t('common.quintal')}` : t('common.noData')}
          </li>
          <li>
            <strong>{t('reports.highestCostCrop')}:</strong> {costliestCrop ? cropLabel(costliestCrop) : t('common.noData')}
          </li>
        </ul>
      </Card>

      <Card className="mb-4">
        <SectionTitle title={t('reports.nextSeasonQuestion')} />
        {bestCrop ? (
          <p className="text-base">
            {t('reports.basedOnData', { crop: cropLabel(bestCrop), amount: formatCurrency(bestCrop.profitPerAcre) })}
          </p>
        ) : (
          <p className="text-base text-slate-600 dark:text-slate-400">{t('reports.notEnoughData')}</p>
        )}
        {costComparison ? <p className="mt-2 text-base">{costComparison}</p> : null}
        {bestFarm ? (
          <p className="mt-2 text-base">{t('reports.interpretationFarmRoi', { farm: bestFarm.name })}</p>
        ) : null}
      </Card>
    </>
  );
}

function CostRevenueTab({
  report,
  cropLabel,
}: {
  report: ReturnType<typeof useSeasonReport>['report'];
  cropLabel: (crop: CropReport) => string;
}) {
  const { t } = useTranslation();

  const rows = (
    items: Array<{ key: string; label: string; metrics: CoreMetrics }>,
  ) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-base">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th scope="col" className="py-2">{t('common.total')}</th>
            <th scope="col" className="py-2 text-right">{t('reports.cost')}</th>
            <th scope="col" className="py-2 text-right">{t('reports.revenue')}</th>
            <th scope="col" className="py-2 text-right">{t('reports.profit')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key} className="border-b border-slate-100 dark:border-slate-800">
              <th scope="row" className="py-2 font-semibold">{item.label}</th>
              <td className="py-2 text-right">{formatCurrency(item.metrics.cost)}</td>
              <td className="py-2 text-right">{formatCurrency(item.metrics.revenue)}</td>
              <td className="py-2 text-right">
                <TrendValue value={item.metrics.profit} formatted={formatCurrency(item.metrics.profit)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <ComboBarCard
        title={t('reports.costVsRevenueFarm')}
        firstLabel={t('reports.cost')}
        secondLabel={t('reports.revenue')}
        data={report.byFarm.map((farm) => ({ name: farm.name, value: farm.cost, secondary: farm.revenue }))}
      />
      <Card className="mb-4">
        {rows(report.byFarm.map((farm) => ({ key: farm.farmId, label: farm.name, metrics: farm })))}
      </Card>

      <ComboBarCard
        title={t('reports.costVsRevenueCrop')}
        firstLabel={t('reports.cost')}
        secondLabel={t('reports.revenue')}
        data={report.byCrop.map((crop) => ({ name: cropLabel(crop), value: crop.cost, secondary: crop.revenue }))}
      />
      <Card>
        {rows(report.byCrop.map((crop) => ({ key: crop.cropId, label: cropLabel(crop), metrics: crop })))}
      </Card>
    </>
  );
}

function RankingTab<T extends CoreMetrics>({
  title,
  ranks,
  labelOf,
}: {
  title: string;
  ranks: Record<string, Array<{ rank: number; value: number; item: T }>>;
  labelOf: (item: T) => string;
}) {
  const { t } = useTranslation();
  const groups: Array<{ key: string; label: string; currency: boolean }> = [
    { key: 'byProfit', label: t('reports.profit'), currency: true },
    { key: 'byProfitPerAcre', label: t('reports.profitPerAcre'), currency: true },
    { key: 'byRevenue', label: t('reports.revenue'), currency: true },
    { key: 'byRoi', label: t('reports.roiShort'), currency: false },
    { key: 'byYieldPerAcre', label: t('reports.yieldPerAcre'), currency: false },
    { key: 'byCostPerAcre', label: t('reports.lowestCost'), currency: true },
  ];

  return (
    <>
      <BarChartCard
        title={title}
        data={(ranks.byProfit ?? []).slice(0, 10).map((entry) => ({ name: labelOf(entry.item), value: entry.value }))}
      />
      {groups.map((group) => {
        const list = ranks[group.key] ?? [];
        if (list.length === 0) return null;
        return (
          <Card key={group.key} className="mb-4">
            <SectionTitle title={group.label} />
            <ol className="space-y-1">
              {list.slice(0, 10).map((entry) => (
                <li key={`${group.key}-${entry.rank}`} className="flex justify-between gap-3 text-base">
                  <span>
                    {entry.rank}. {labelOf(entry.item)}
                  </span>
                  <span className="font-semibold">
                    {group.currency ? formatCurrency(entry.value) : `${formatNumber(entry.value, 2)}${group.key === 'byRoi' ? '%' : ''}`}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        );
      })}
    </>
  );
}

function BestCropsTab({
  best,
  cropLabel,
}: {
  best: ReturnType<typeof analyseBestCrops>;
  cropLabel: (crop: CropReport) => string;
}) {
  const { t } = useTranslation();
  const rows: Array<{ label: string; crop: CropReport | null; value: string }> = [
    {
      label: t('reports.highestTotalProfit'),
      crop: best.highestTotalProfit,
      value: formatCurrency(best.highestTotalProfit?.profit ?? 0),
    },
    {
      label: t('reports.highestProfitPerAcre'),
      crop: best.highestProfitPerAcre,
      value: formatCurrency(best.highestProfitPerAcre?.profitPerAcre ?? 0),
    },
    { label: t('reports.highestRoi'), crop: best.highestRoi, value: `${formatNumber(best.highestRoi?.roi ?? 0, 1)}%` },
    {
      label: t('reports.highestYield'),
      crop: best.highestYieldPerAcre,
      value: `${formatNumber(best.highestYieldPerAcre?.yieldPerAcre ?? 0, 2)} ${t('common.quintal')}`,
    },
    {
      label: t('reports.lowestCost'),
      crop: best.lowestCostPerAcre,
      value: formatCurrency(best.lowestCostPerAcre?.costPerAcre ?? 0),
    },
  ];

  return (
    <>
      <Card className="mb-4">
        <SectionTitle title={t('reports.bestCrops')} />
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-wrap justify-between gap-2 text-base">
              <span className="font-semibold">{row.label}</span>
              <span>{row.crop ? `${cropLabel(row.crop)} — ${row.value}` : t('common.noData')}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-4">
        <SectionTitle title={t('reports.performanceScore')} />
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{t('reports.performanceScoreHelp')}</p>
        <ol className="space-y-1">
          {best.scores.map((score, index) => (
            <li key={score.item.cropId} className="flex justify-between gap-3 text-base">
              <span>
                {index + 1}. {cropLabel(score.item)}
              </span>
              <span className="font-semibold">{formatNumber(score.score, 1)} / 100</span>
            </li>
          ))}
        </ol>
      </Card>

      <BarChartCard
        title={t('reports.bestValue')}
        currency={false}
        data={best.scores.map((score) => ({ name: cropLabel(score.item), value: score.score }))}
      />
    </>
  );
}

function ComparisonTab({
  farms,
  crops,
  cropLabel,
}: {
  farms: FarmReport[];
  crops: CropReport[];
  cropLabel: (crop: CropReport) => string;
}) {
  const { t } = useTranslation();
  const [selectedFarms, setSelectedFarms] = useState<string[]>([]);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);

  const metricRows: Array<{ key: keyof CoreMetrics; label: string; currency: boolean }> = [
    { key: 'acres', label: t('common.area'), currency: false },
    { key: 'cost', label: t('reports.cost'), currency: true },
    { key: 'revenue', label: t('reports.revenue'), currency: true },
    { key: 'profit', label: t('reports.profit'), currency: true },
    { key: 'profitPerAcre', label: t('reports.profitPerAcre'), currency: true },
    { key: 'costPerAcre', label: t('reports.costPerAcre'), currency: true },
    { key: 'roi', label: t('reports.roiShort'), currency: false },
    { key: 'yieldPerAcre', label: t('reports.yieldPerAcre'), currency: false },
    { key: 'activityCount', label: t('reports.activityCount'), currency: false },
    { key: 'irrigationCount', label: t('farms.irrigationCount'), currency: false },
    { key: 'sprayCount', label: t('farms.sprayCount'), currency: false },
  ];

  const toggle = (list: string[], setList: (value: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

  const renderTable = (
    items: Array<{ id: string; label: string; metrics: CoreMetrics }>,
  ) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-base">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th scope="col" className="py-2" />
            {items.map((item) => (
              <th key={item.id} scope="col" className="py-2 text-right">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metricRows.map((row) => (
            <tr key={String(row.key)} className="border-b border-slate-100 dark:border-slate-800">
              <th scope="row" className="py-2 font-semibold">
                {row.label}
              </th>
              {items.map((item) => (
                <td key={item.id} className="py-2 text-right">
                  {row.currency
                    ? formatCurrency(Number(item.metrics[row.key]))
                    : formatNumber(Number(item.metrics[row.key]), 2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Card className="mb-4">
        <SectionTitle title={t('reports.farmComparison')} />
        <div className="mb-3 flex flex-wrap gap-2">
          {farms.map((farm) => (
            <button
              key={farm.farmId}
              type="button"
              aria-pressed={selectedFarms.includes(farm.farmId)}
              onClick={() => toggle(selectedFarms, setSelectedFarms, farm.farmId)}
              className={`min-h-touch rounded-xl px-3 py-2 text-base font-semibold ${
                selectedFarms.includes(farm.farmId)
                  ? 'bg-brand-700 text-white'
                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {farm.name}
            </button>
          ))}
        </div>
        {selectedFarms.length < 2 ? (
          <p className="text-base text-slate-600 dark:text-slate-400">{t('reports.selectAtLeastTwo')}</p>
        ) : (
          renderTable(
            farms
              .filter((farm) => selectedFarms.includes(farm.farmId))
              .map((farm) => ({ id: farm.farmId, label: farm.name, metrics: farm })),
          )
        )}
      </Card>

      <Card>
        <SectionTitle title={t('reports.cropComparison')} />
        <div className="mb-3 flex flex-wrap gap-2">
          {crops.map((crop) => (
            <button
              key={crop.cropId}
              type="button"
              aria-pressed={selectedCrops.includes(crop.cropId)}
              onClick={() => toggle(selectedCrops, setSelectedCrops, crop.cropId)}
              className={`min-h-touch rounded-xl px-3 py-2 text-base font-semibold ${
                selectedCrops.includes(crop.cropId)
                  ? 'bg-brand-700 text-white'
                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {cropLabel(crop)}
            </button>
          ))}
        </div>
        {selectedCrops.length < 2 ? (
          <p className="text-base text-slate-600 dark:text-slate-400">{t('reports.selectAtLeastTwo')}</p>
        ) : (
          renderTable(
            crops
              .filter((crop) => selectedCrops.includes(crop.cropId))
              .map((crop) => ({ id: crop.cropId, label: cropLabel(crop), metrics: crop })),
          )
        )}
      </Card>
    </>
  );
}

export { performanceScores };
