import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Card, EmptyState, LoadingBlock, PageHeader } from '../ui/Layout';
import { ConfirmDialog } from '../ui/Modal';

/**
 * Shared screen for every "list of records" page: header, add button,
 * mobile-friendly cards, empty state and a delete confirmation.
 */

export interface RecordScreenProps<T extends { id: string }> {
  title: string;
  subtitle?: string;
  addLabel: string;
  emptyMessage: string;
  emptyActionLabel: string;
  records: T[];
  loading: boolean;
  canEdit?: boolean;
  renderItem: (record: T) => ReactNode;
  deleteMessage: (record: T) => string;
  onAdd: () => void;
  onEdit: (record: T) => void;
  onDelete: (record: T) => Promise<void> | void;
  filters?: ReactNode;
  children?: ReactNode;
}

export function RecordScreen<T extends { id: string }>({
  title,
  subtitle,
  addLabel,
  emptyMessage,
  emptyActionLabel,
  records,
  loading,
  canEdit = true,
  renderItem,
  deleteMessage,
  onAdd,
  onEdit,
  onDelete,
  filters,
  children,
}: RecordScreenProps<T>) {
  const { t } = useTranslation();
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <section>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          canEdit ? (
            <Button onClick={onAdd} icon={<span aria-hidden="true">＋</span>}>
              {addLabel}
            </Button>
          ) : undefined
        }
      />

      {filters}

      {loading ? (
        <LoadingBlock label={t('common.loading')} />
      ) : records.length === 0 ? (
        <EmptyState message={emptyMessage} actionLabel={canEdit ? emptyActionLabel : undefined} onAction={onAdd} />
      ) : (
        <ul className="space-y-3">
          {records.map((record) => (
            <li key={record.id}>
              <Card>
                {renderItem(record)}
                {canEdit ? (
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Button variant="secondary" size="sm" onClick={() => onEdit(record)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingDelete(record)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Sticky add button keeps the most common action in thumb reach. */}
      {canEdit && records.length > 0 ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          className="fixed bottom-24 right-4 z-30 min-h-[56px] min-w-[56px] rounded-full bg-brand-700 text-2xl font-bold text-white shadow-lg lg:bottom-8"
        >
          ＋
        </button>
      ) : null}

      {children}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('common.delete')}
        message={pendingDelete ? deleteMessage(pendingDelete) : ''}
        confirmLabel={t('common.delete')}
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          setDeleting(true);
          try {
            await onDelete(pendingDelete);
          } finally {
            setDeleting(false);
            setPendingDelete(null);
          }
        }}
      />
    </section>
  );
}

export function RecordLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="text-right text-base font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

/** Shown when no season exists yet - every record needs one. */
export function NoSeasonNotice() {
  const { t } = useTranslation();
  return <EmptyState message={t('seasons.empty')} actionLabel={t('seasons.emptyAction')} to="/seasons" />;
}
