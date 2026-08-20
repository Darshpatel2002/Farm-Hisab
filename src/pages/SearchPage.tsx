import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui/Layout';
import { listRows } from '../lib/supabase/crud';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/formatting/number';
import { formatDate } from '../lib/formatting/date';

/** Global search across farms, crops, expense descriptions, buyers and vendors. */
export default function SearchPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const term = (params.get('q') ?? '').trim();
  const { profile } = useAuth();
  const { farms, crops, cropName } = useAppData();

  const remoteQuery = useQuery({
    queryKey: ['search', profile?.household_id, term],
    enabled: term.length > 1 && Boolean(profile),
    queryFn: async () => {
      const [expenses, sales] = await Promise.all([
        listRows('expenses', { search: { columns: ['description', 'vendor'], term }, limit: 25 }),
        listRows('sales', { search: { columns: ['buyer', 'notes'], term }, limit: 25 }),
      ]);
      return { expenses, sales };
    },
  });

  const lower = term.toLowerCase();
  const matchedFarms = useMemo(
    () => farms.filter((f) => f.name.toLowerCase().includes(lower) || f.local_name.toLowerCase().includes(lower)),
    [farms, lower],
  );
  const matchedCrops = useMemo(
    () => crops.filter((c) => c.name.toLowerCase().includes(lower) || c.name_gu.includes(term)),
    [crops, lower, term],
  );

  if (term.length < 2) return <EmptyState message={t('search.placeholder')} />;
  if (remoteQuery.isLoading) return <LoadingBlock label={t('common.loading')} />;

  const expenses = remoteQuery.data?.expenses ?? [];
  const sales = remoteQuery.data?.sales ?? [];
  const total = matchedFarms.length + matchedCrops.length + expenses.length + sales.length;

  if (total === 0) return <EmptyState message={t('search.noResults', { term })} />;

  return (
    <section>
      <PageHeader title={t('search.title')} subtitle={`${total} ${t('common.results')}`} />

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
        <Card>
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
    </section>
  );
}
