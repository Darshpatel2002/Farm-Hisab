import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/Layout';

/** Big, obvious buttons for the six things recorded most often. */
const ACTIONS = [
  { to: '/expenses', key: 'expenses.add', icon: '💰' },
  { to: '/sprays', key: 'sprays.add', icon: '🧴' },
  { to: '/irrigation', key: 'irrigation.add', icon: '💧' },
  { to: '/activities', key: 'activities.add', icon: '🚜' },
  { to: '/harvest', key: 'harvest.add', icon: '🧺' },
  { to: '/sales', key: 'sales.add', icon: '🏷️' },
  { to: '/seeds', key: 'seeds.add', icon: '🌰' },
  { to: '/fertilizers', key: 'fertilizers.add', icon: '🧪' },
] as const;

export default function QuickAddPage() {
  const { t } = useTranslation();
  return (
    <section>
      <PageHeader title={t('dashboard.quickAdd')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-brand-700 px-4 py-4 text-lg font-semibold text-white hover:bg-brand-800"
          >
            <span aria-hidden="true" className="text-3xl">
              {action.icon}
            </span>
            {t(action.key)}
          </Link>
        ))}
      </div>
    </section>
  );
}
