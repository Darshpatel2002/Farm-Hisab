import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui/Layout';
import { listRows } from '../lib/supabase/crud';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/formatting/number';
import { formatDate } from '../lib/formatting/date';

/** Global search across farms, crops, expenses, sales, sprays, fertilizer, seeds and activities. */
export default function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  const { farms, crops, cropName } = useAppData();

  const [term, setTerm] = useState((params.get('q') ?? '').trim());
  const trimmed = term.trim();

  const remoteQuery = useQuery({
    queryKey: ['search', profile?.household_id, trimmed],
    enabled: trimmed.length > 1 && Boolean(profile),
    queryFn: async () => {
      const [expenses, sales, sprays, fertilizers, seeds, activities] = await Promise.all([
        listRows('expenses', { search: { columns: ['description', 'vendor'], term: trimmed }, limit: 25 }),
        listRows('sales', { search: { columns: ['buyer', 'notes'], term: trimmed }, limit: 25 }),
        listRows('spray_records', { search: { columns: ['product_name', 'notes'], term: trimmed }, limit: 25 }),
        listRows('fertilizer_records', { search: { columns: ['product_name', 'notes'], term: trimmed }, limit: 25 }),
        listRows('seed_records', { search: { columns: ['variety', 'supplier', 'notes'], term: trimmed }, limit: 25 }),
        listRows('activities', { search: { columns: ['description', 'vendor', 'notes'], term: trimmed }, limit: 25 }),
      ]);
      return { expenses, sales, sprays, fertilizers, seeds, activities };
    },
  });

  const lower = trimmed.toLowerCase();
  const matchedFarms = useMemo(
    () => (trimmed ? farms.filter((f) => f.name.toLowerCase().includes(lower) || f.local_name.toLowerCase().includes(lower)) : []),
    [farms, lower, trimmed],
  );
  const matchedCrops = useMemo(
    () => (trimmed ? crops.filter((c) => c.name.toLowerCase().includes(lower) || c.name_gu.includes(trimmed)) : []),
    [crops, lower, trimmed],
  );

  const expenses = remoteQuery.data?.expenses ?? [];
  const sales = remoteQuery.data?.sales ?? [];
  const sprays = remoteQuery.data?.sprays ?? [];
  const fertilizers = remoteQuery.data?.fertilizers ?? [];
  const seeds = remoteQuery.data?.seeds ?? [];
  const activities = remoteQuery.data?.activities ?? [];

  const total =
    matchedFarms.length +
    matchedCrops.length +
    expenses.length +
    sales.length +
    sprays.length +
    fertilizers.length +
    seeds.length +
    activities.length;

  const onChange = (value: string) => {
    setTerm(value);
    setParams(value.trim() ? { q: value.trim() } : {}, { replace: true });
  };

  return (
    <section>
      <PageHeader title={t('search.title')} subtitle={trimmed.length > 1 ? `${total} ${t('common.results')}` : undefined} />

      <div className="mb-4">
        <label className="sr-only" htmlFor="search-input">
          {t('search.title')}
        </label>
        <input
          id="search-input"
          type="search"
          autoFocus
          value={term}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('search.placeholder')}
          className="input"
        />
      </div>

      {trimmed.length < 2 ? (
        <EmptyState message={t('search.placeholder')} />
      ) : remoteQuery.isLoading ? (
        <LoadingBlock label={t('common.loading')} />
      ) : total === 0 ? (
        <EmptyState message={t('search.noResults', { term: trimmed })} />
      ) : (
        <>
          {matchedFarms.length > 0 ? (
            <Card className="mb-4">
              <SectionTitle title={t('search.farms')} />
              <ul className="space-y-2">
                {matchedFarms.map((farm) => (
                  <li key={farm.id}>
                    <Link to={`/farms/${farm.id}`} className="text-base font-semibold underline">
                      {farm.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {matchedCrops.length > 0 ? (
            <Card className="mb-4">
              <SectionTitle title={t('search.crops')} />
              <ul className="space-y-2">
                {matchedCrops.map((crop) => (
                  <li key={crop.id} className="text-base font-semibold">
                    {cropName(crop.id)}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {expenses.length > 0 ? (
            <Card className="mb-4">
              <SectionTitle title={t('search.expenses')} />
              <ul className="space-y-2">
                {expenses.map((expense) => (
                  <li key={expense.id} className="flex justify-between gap-3 text-base">
                    <span>
                      {formatDate(expense.date)} — {expense.description || t(`categories.${expense.category}`)}
                    </span>
                    <span className="font-semibold">{formatCurrency(expense.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {sales.length > 0 ? (
            <Card className="mb-4">
              <SectionTitle title={t('search.sales')} />
              <ul className="space-y-2">
                {sales.map((sale) => (
                  <li key={sale.id} className="flex justify-between gap-3 text-base">
                    <span>
                      {formatDate(sale.date)} — {sale.buyer}
                    </span>
                    <span className="font-semibold">{formatCurrency(sale.net_amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {sprays.length > 0 ? (
            <Card className="mb-4">
              <SectionTitle title={t('nav.sprays')} />
              <ul className="space-y-2">
                {sprays.map((spray) => (
                  <li key={spray.id} className="flex justify-between gap-3 text-base">
                    <span>
                      {formatDate(spray.date)} — {spray.product_name}
                    </span>
                    <span className="font-semibold">{formatCurrency(spray.total_cost)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {fertilizers.length > 0 ? (
            <Card className="mb-4">
              <SectionTitle title={t('nav.fertilizers')} />
              <ul className="space-y-2">
                {fertilizers.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3 text-base">
                    <span>
                      {formatDate(row.date)} — {row.product_name}
                    </span>
                    <span className="font-semibold">{formatCurrency(row.total_cost)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {seeds.length > 0 ? (
            <Card className="mb-4">
              <SectionTitle title={t('nav.seeds')} />
              <ul className="space-y-2">
                {seeds.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3 text-base">
                    <span>
                      {formatDate(row.date)} — {row.variety}
                    </span>
                    <span className="font-semibold">{formatCurrency(row.total_cost)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {activities.length > 0 ? (
            <Card>
              <SectionTitle title={t('nav.activities')} />
              <ul className="space-y-2">
                {activities.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3 text-base">
                    <span>
                      {formatDate(row.date)} — {row.description || t(`activityTypes.${row.activity_type}`)}
                    </span>
                    <span className="font-semibold">{formatCurrency(row.cost)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </section>
  );
}
