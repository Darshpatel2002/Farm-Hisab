import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';

/**
 * Guards against an accidental exit. When the phone/browser back button is
 * pressed we intercept it and ask whether to stay or log out, instead of
 * silently closing the app. A native prompt also covers tab refresh/close.
 */
export function ExitGuard() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Seed a history entry so the first back press stays inside the app.
    window.history.pushState({ farmGuard: true }, '');

    const onPopState = () => {
      // Re-seed and prompt so a mis-tap never drops the user out of the app.
      window.history.pushState({ farmGuard: true }, '');
      setOpen(true);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <Modal
      open={open}
      title={t('exit.title')}
      onClose={() => setOpen(false)}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
            {t('exit.stay')}
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
          >
            {t('auth.signOut')}
          </Button>
        </>
      }
    >
      <p className="whitespace-pre-line text-base text-slate-700 dark:text-slate-300">{t('exit.message')}</p>
    </Modal>
  );
}
