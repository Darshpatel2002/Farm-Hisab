import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { toAppError } from '../lib/errors';
import { forgotPasswordSchema, signInSchema, signUpSchema } from '../lib/validation/schemas';
import { useZodForm, str } from '../features/common/useZodForm';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';

type Mode = 'signIn' | 'signUp' | 'forgot';

export default function AuthPage() {
  const { t, i18n } = useTranslation();
  const { signIn, signUp, resetPassword } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('signIn');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const schema = mode === 'signIn' ? signInSchema : mode === 'signUp' ? signUpSchema : forgotPasswordSchema;
  const form = useZodForm(schema, {
    email: '',
    password: '',
    fullName: '',
    householdName: '',
    inviteCode: '',
  });

  const submit = async () => {
    const result = form.validate();
    if (!result.success) return;
    setBusy(true);
    setNotice(null);
    try {
      if (mode === 'signIn') {
        await signIn(str(form.values, 'email'), str(form.values, 'password'));
      } else if (mode === 'signUp') {
        const { needsConfirmation } = await signUp({
          email: str(form.values, 'email'),
          password: str(form.values, 'password'),
          fullName: str(form.values, 'fullName'),
          householdName: str(form.values, 'householdName'),
          inviteCode: str(form.values, 'inviteCode'),
        });
        if (needsConfirmation) {
          setNotice(t('auth.checkEmail'));
          setMode('signIn');
        }
      } else {
        await resetPassword(str(form.values, 'email'));
        setNotice(t('auth.resetLinkSent'));
        setMode('signIn');
      }
    } catch (error) {
      toast.error(t(toAppError(error).messageKey));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <span aria-hidden="true" className="text-5xl">
            🌿
          </span>
          <h1 className="mt-2 text-3xl font-bold text-brand-900 dark:text-brand-100">{t('app.name')}</h1>
          <p className="text-base text-slate-600 dark:text-slate-400">
            {mode === 'signUp' ? t('auth.signUpSubtitle') : t('auth.signInSubtitle')}
          </p>
        </div>

        <div className="card">
          {notice ? (
            <p role="status" className="mb-3 rounded-xl bg-brand-100 p-3 text-base font-semibold text-brand-900">
              {notice}
            </p>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            noValidate
          >
            {mode === 'signUp' ? (
              <TextField
                label={t('auth.fullName')}
                required
                autoComplete="name"
                value={str(form.values, 'fullName')}
                error={form.errors.fullName}
                onChange={(e) => form.setField('fullName', e.target.value)}
              />
            ) : null}

            <TextField
              label={t('auth.email')}
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              value={str(form.values, 'email')}
              error={form.errors.email}
              onChange={(e) => form.setField('email', e.target.value)}
            />

            {mode !== 'forgot' ? (
              <TextField
                label={t('auth.password')}
                type="password"
                required
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                value={str(form.values, 'password')}
                error={form.errors.password}
                onChange={(e) => form.setField('password', e.target.value)}
              />
            ) : null}

            {mode === 'signUp' ? (
              <>
                <TextField
                  label={`${t('auth.householdName')} (${t('common.optional')})`}
                  value={str(form.values, 'householdName')}
                  error={form.errors.householdName}
                  onChange={(e) => form.setField('householdName', e.target.value)}
                />
                <TextField
                  label={`${t('auth.inviteCode')} (${t('common.optional')})`}
                  hint={t('auth.inviteCodeHelp')}
                  value={str(form.values, 'inviteCode')}
                  error={form.errors.inviteCode}
                  onChange={(e) => form.setField('inviteCode', e.target.value.toUpperCase())}
                />
              </>
            ) : null}

            <Button type="submit" size="lg" fullWidth loading={busy}>
              {mode === 'signIn' ? t('auth.signIn') : mode === 'signUp' ? t('auth.signUp') : t('auth.resetPassword')}
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-center">
            {mode !== 'forgot' ? (
              <button type="button" className="text-base font-semibold text-brand-800 underline dark:text-brand-200" onClick={() => setMode('forgot')}>
                {t('auth.forgotPassword')}
              </button>
            ) : null}
            <button
              type="button"
              className="text-base font-semibold text-brand-800 underline dark:text-brand-200"
              onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
            >
              {mode === 'signIn' ? t('auth.needAccount') : t('auth.haveAccount')}
            </button>
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {SUPPORTED_LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => setLanguage(language.code)}
              aria-pressed={i18n.language === language.code}
              className={`min-h-touch rounded-xl px-4 py-2 text-base font-semibold ${
                i18n.language === language.code
                  ? 'bg-brand-700 text-white'
                  : 'bg-white text-brand-800 dark:bg-slate-900 dark:text-brand-200'
              }`}
            >
              {language.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
