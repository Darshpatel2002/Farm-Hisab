import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Card, SectionTitle } from '../ui/Layout';
import { formatCurrency, formatNumber } from '../../lib/formatting/number';

/**
 * Chart wrappers tuned for small screens: short labels, generous touch
 * targets and a readable palette that also works in dark mode.
 */

const PALETTE = ['#2b7632', '#8a6a43', '#5fb05d', '#b45309', '#0f766e', '#7c3aed', '#be123c', '#0369a1', '#4d7c0f', '#a16207'];

export interface ChartDatum {
  name: string;
  value: number;
  secondary?: number;
}

function EmptyChart() {
  const { t } = useTranslation();
  return <p className="py-8 text-center text-base text-slate-600 dark:text-slate-400">{t('reports.notEnoughData')}</p>;
}

export function BarChartCard({
  title,
  data,
  currency = true,
  height = 260,
}: {
  title: string;
  data: ChartDatum[];
  currency?: boolean;
  height?: number;
}) {
  const format = (value: number) => (currency ? formatCurrency(value, { compact: true }) : formatNumber(value, 2));
  return (
    <Card className="mb-4">
      <SectionTitle title={title} />
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={62} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => format(v)} width={70} />
            <Tooltip formatter={(v: number) => format(v)} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={entry.value < 0 ? '#b91c1c' : PALETTE[index % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function PieChartCard({ title, data, height = 260 }: { title: string; data: ChartDatum[]; height?: number }) {
  return (
    <Card className="mb-4">
      <SectionTitle title={title} />
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius="75%" label={false}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function ComboBarCard({
  title,
  data,
  firstLabel,
  secondLabel,
  height = 260,
}: {
  title: string;
  data: ChartDatum[];
  firstLabel: string;
  secondLabel: string;
  height?: number;
}) {
  return (
    <Card className="mb-4">
      <SectionTitle title={title} />
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={62} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} width={70} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar dataKey="value" name={firstLabel} fill="#8a6a43" radius={[6, 6, 0, 0]} />
            <Bar dataKey="secondary" name={secondLabel} fill="#2b7632" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function LineChartCard({
  title,
  data,
  firstLabel,
  secondLabel,
  height = 260,
}: {
  title: string;
  data: ChartDatum[];
  firstLabel: string;
  secondLabel: string;
  height?: number;
}) {
  return (
    <Card className="mb-4">
      <SectionTitle title={title} />
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} width={70} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Line type="monotone" dataKey="value" name={firstLabel} stroke="#b45309" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="secondary" name={secondLabel} stroke="#2b7632" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export interface ScatterDatum {
  name: string;
  effort: number;
  profit: number;
  quadrant: string;
}

export function EffortScatterCard({
  title,
  data,
  effortMedian,
  profitMedian,
  height = 300,
}: {
  title: string;
  data: ScatterDatum[];
  effortMedian: number;
  profitMedian: number;
  height?: number;
}) {
  const { t } = useTranslation();
  const groups = [
    { key: 'highProfitLowEffort', color: '#2b7632' },
    { key: 'highProfitHighEffort', color: '#0369a1' },
    { key: 'lowProfitLowEffort', color: '#a16207' },
    { key: 'lowProfitHighEffort', color: '#be123c' },
  ];

  return (
    <Card className="mb-4">
      <SectionTitle title={title} />
      <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{t('reports.effortHelp')}</p>
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis
                type="number"
                dataKey="effort"
                name={t('reports.effort')}
                tick={{ fontSize: 12 }}
                label={{ value: t('reports.effort'), position: 'insideBottom', offset: -14, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="profit"
                name={t('reports.profitPerAcre')}
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
                width={70}
              />
              <ZAxis range={[120, 121]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number, key: string) =>
                  key === 'profit' ? formatCurrency(value) : formatNumber(value, 2)
                }
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              {groups.map((group) => (
                <Scatter
                  key={group.key}
                  name={t(`reports.quadrant${group.key.charAt(0).toUpperCase()}${group.key.slice(1)}`)}
                  data={data.filter((d) => d.quadrant === group.key)}
                  fill={group.color}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t('reports.effort')}: {formatNumber(effortMedian, 2)} · {t('reports.profitPerAcre')}:{' '}
            {formatCurrency(profitMedian)}
          </p>
        </>
      )}
    </Card>
  );
}
