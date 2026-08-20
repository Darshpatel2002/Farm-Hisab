import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, PageHeader } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

const LINKS = [
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
  { to: '/settings', key: 'settings', icon: '⚙️' },
] as const;

export default function MorePage() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();

  return (
    <section>
      <PageHeader title={t('nav.more')} subtitle={profile?.full_name} />
      <Card>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="flex min-h-[56px] items-center gap-3 py-2 text-lg font-semibold">
                <span aria-hidden="true" className="text-2xl">
                  {link.icon}
                </span>
                {t(`nav.${link.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Button className="mt-4" variant="secondary" fullWidth onClick={() => void signOut()}>
        {t('auth.signOut')}
      </Button>
    </section>
  );
}
