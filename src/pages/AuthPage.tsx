import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { toAppError } from '../lib/errors';
import { forgotPasswordSchema, signInSchema, signUpSchema } from '../lib/validation/schemas';
import { useZodForm, str } from '../features/common/useZodForm';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';
import { SCENES } from '../components/layout/scenery';

type Mode = 'signIn' | 'signUp' | 'forgot';

export default function AuthPage() {
  const { t, i18n } = useTranslation();
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
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

  const panel =
    mode === 'signUp'
      ? { emoji: '🌱', title: t('auth.signUpSubtitle') }
      : mode === 'forgot'
        ? { emoji: '🔑', title: t('auth.resetPassword') }
        : { emoji: '🌾', title: t('auth.welcomeBack') };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Visual brand panel - changes with the current mode. */}
      <aside className="relative hidden overflow-hidden bg-brand-sheen p-12 text-white lg:flex lg:flex-col">
        <span aria-hidden="true" className="absolute inset-0 bg-cover bg-bottom" style={{ backgroundImage: SCENES.dashboard }} />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-brand-900/90 via-brand-800/55 to-brand-900/75" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-harvest-400/20 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">🌿</span>
          <span className="text-2xl font-extrabold tracking-tight">{t('app.name')}</span>
        </div>

        <div className="relative my-auto max-w-md">
          <span className="mb-4 inline-block animate-float text-7xl">{panel.emoji}</span>
          <h2 className="text-4xl font-extrabold leading-tight">{panel.title}</h2>
          <p className="mt-4 text-lg text-brand-50/90">{t('landing.heroSubtitle')}</p>

          <ul className="mt-8 space-y-3">
            {['reports', 'photos', 'offline'].map((key) => (
              <li key={key} className="flex items-center gap-3 text-brand-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">✓</span>
                <span className="font-semibold">{t(`landing.feature.${key}.title`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-brand-50/80">🌿 {t('landing.footer')}</p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-white p-4 dark:from-slate-950 dark:to-slate-900">
        <div className="w-full max-w-md animate-scale-in">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-4 inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-sm font-bold text-brand-800 shadow-sm ring-1 ring-brand-100 backdrop-blur dark:bg-slate-900/70 dark:text-brand-200 dark:ring-slate-700"
          >
            ← {t('landing.home')}
          </button>

          <div className="mb-6 text-center lg:hidden">
            <span aria-hidden="true" className="text-5xl">{panel.emoji}</span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gradient">{t('app.name')}</h1>
            <p className="text-base font-medium text-slate-600 dark:text-slate-400">
              {mode === 'signUp' ? t('auth.signUpSubtitle') : t('auth.signInSubtitle')}
            </p>
          </div>

          <div className="mb-4 hidden lg:block">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{panel.title}</h1>
            <p className="mt-1 text-base font-medium text-slate-600 dark:text-slate-400">
              {mode === 'signUp' ? t('auth.signUpSubtitle') : t('auth.signInSubtitle')}
            </p>
          </div>

          <div className="card shadow-lift">
            {notice ? (
              <p role="status" className="mb-4 rounded-2xl bg-brand-100 p-3 text-base font-semibold text-brand-900 dark:bg-brand-900/50 dark:text-brand-100">
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
                name="email"
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
                  name="password"
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

            <div className="mt-5 flex flex-col gap-2 text-center">
              {mode !== 'forgot' ? (
                <button type="button" className="text-base font-semibold text-brand-700 hover:underline dark:text-brand-300" onClick={() => setMode('forgot')}>
                  {t('auth.forgotPassword')}
                </button>
              ) : null}
              <button
                type="button"
                className="text-base font-semibold text-brand-700 hover:underline dark:text-brand-300"
                onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
              >
                {mode === 'signIn' ? t('auth.needAccount') : t('auth.haveAccount')}
              </button>
            </div>
          </div>

          <div className="mt-5 flex justify-center gap-2">
            {SUPPORTED_LANGUAGES.map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => setLanguage(language.code)}
                aria-pressed={i18n.language === language.code}
                className={`min-h-touch rounded-2xl px-5 py-2 text-base font-bold shadow-sm transition ${
                  i18n.language === language.code
                    ? 'bg-gradient-to-b from-brand-600 to-brand-700 text-white'
                    : 'bg-white/80 text-brand-800 ring-1 ring-brand-100 dark:bg-slate-900/80 dark:text-brand-200 dark:ring-slate-700'
                }`}
              >
                {language.label}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
