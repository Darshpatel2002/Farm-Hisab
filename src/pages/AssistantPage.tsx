import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/Layout';
import { FarmChat } from '../components/ai/FarmChat';

export default function AssistantPage() {
  const { t } = useTranslation();
  return (
    <section className="flex min-h-[70vh] flex-col">
      <PageHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')} />
      <div className="card flex min-h-[60vh] flex-1 flex-col overflow-hidden p-4">
        <FarmChat />
      </div>
    </section>
  );
}
