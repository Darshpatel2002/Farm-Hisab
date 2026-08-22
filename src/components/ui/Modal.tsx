import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { usePageTheme } from '../layout/pageTheme';

/** Bottom sheet on phones, centred dialog on desktop. */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const theme = usePageTheme();

  // Move focus into the dialog once, when it opens. Depending on anything that
  // changes per render would pull focus back out of the field being typed in.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    // A reopened dialog must always start at the first field, not where it was left.
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      {/*
        The panel is a flex column: only the middle section scrolls, so the
        title and the Save/Cancel buttons are always on screen.
      */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full animate-scale-in flex-col overflow-hidden rounded-t-4xl border border-white/60 bg-white shadow-lift
          dark:border-slate-700/60 dark:bg-slate-900 sm:max-h-[85vh] sm:max-w-2xl sm:rounded-4xl"
      >
        {/* Grab handle hints that the sheet is scrollable on a phone. */}
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden" />

        <header
          className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r ${theme.gradient} px-5 py-4 dark:border-slate-800`}
        >
          <h2 className="flex min-w-0 items-center gap-2.5 text-xl font-extrabold tracking-tight text-white">
            <span aria-hidden="true" className="text-2xl">{theme.icon}</span>
            <span className="truncate">{title}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white transition hover:bg-white/30"
          >
            ✕
          </button>
        </header>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {children}
        </div>

        {footer ? (
          <footer className="safe-bottom flex shrink-0 gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} fullWidth loading={busy} onClick={onConfirm}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className="whitespace-pre-line text-base text-slate-700 dark:text-slate-300">{message}</p>
      {children}
    </Modal>
  );
}
