import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FarmChat } from './FarmChat';

/** Floating assistant available on every screen. */
export function ChatBubble() {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // The dedicated page already shows the chat.
  const onAssistantPage = location.pathname.startsWith('/assistant');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (onAssistantPage) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('assistant.open')}
          className="fixed bottom-28 left-4 z-40 flex min-h-[56px] items-center gap-2 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 px-4 text-white shadow-lift ring-4 ring-white/70 transition hover:scale-105 active:scale-95 dark:ring-slate-900/70 lg:bottom-8"
        >
          <span aria-hidden="true" className="text-2xl">🌾</span>
          <span className="hidden text-sm font-bold sm:inline">{t('assistant.short')}</span>
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 sm:items-end sm:justify-end sm:p-6" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('assistant.title')}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[85dvh] max-h-full w-full animate-scale-in flex-col overflow-hidden rounded-t-4xl border border-white/60 bg-white shadow-lift dark:border-slate-700/60 dark:bg-slate-900 sm:h-[640px] sm:w-[420px] sm:rounded-4xl"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-800 px-5 py-4">
              <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-white">
                <span aria-hidden="true" className="text-2xl">🌾</span>
                {t('assistant.title')}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white transition hover:bg-white/30"
              >
                ✕
              </button>
            </header>

            <FarmChat compact />
          </div>
        </div>
      ) : null}
    </>
  );
}
