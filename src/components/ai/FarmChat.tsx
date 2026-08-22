import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { useFarmChat, type ChatTurn } from '../../features/ai/useFarmChat';

/** Prompts that show a farmer what the assistant is good at. */
const SUGGESTIONS = ['assistant.q1', 'assistant.q2', 'assistant.q3', 'assistant.q4'] as const;

function Bubble({ turn }: { turn: ChatTurn }) {
  const mine = turn.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-base leading-relaxed shadow-sm ${
          mine
            ? 'rounded-br-lg bg-gradient-to-br from-brand-600 to-brand-700 text-white'
            : 'rounded-bl-lg border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
        }`}
      >
        {turn.text}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-1.5 rounded-3xl rounded-bl-lg border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand-500"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function FarmChat({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { turns, pending, errorKey, errorDetail, ask, reset } = useFarmChat();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, pending]);

  const send = () => {
    const question = draft;
    setDraft('');
    void ask(question);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto ${compact ? 'px-4 py-4' : 'px-1 py-2'}`}>
        {turns.length === 0 ? (
          <div className="py-4 text-center">
            <span aria-hidden="true" className="text-5xl">🌾</span>
            <p className="mt-3 text-lg font-bold text-slate-800 dark:text-slate-100">{t('assistant.greeting')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">{t('assistant.greetingHelp')}</p>

            <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
              {SUGGESTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void ask(t(key))}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, index) => <Bubble key={index} turn={turn} />)
        )}

        {pending ? <TypingDots /> : null}

        {errorKey ? (
          <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 dark:bg-red-900/40">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">{t(errorKey)}</p>
            {errorDetail ? (
              <p className="mt-1 break-all font-mono text-xs text-red-700/80 dark:text-red-300/80">{errorDetail}</p>
            ) : null}
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className={`flex shrink-0 items-end gap-2 border-t border-slate-200 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95 ${
          compact ? 'px-4 py-3' : 'pt-3'
        }`}
      >
        <label className="sr-only" htmlFor="assistant-input">
          {t('assistant.inputLabel')}
        </label>
        <textarea
          id="assistant-input"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t('assistant.placeholder')}
          className="input max-h-32 min-h-touch flex-1 resize-none py-3"
        />
        <Button type="submit" loading={pending} disabled={!draft.trim()} aria-label={t('assistant.send')}>
          ➤
        </Button>
      </form>

      {turns.length > 0 ? (
        <div className={`flex shrink-0 items-center justify-between gap-2 ${compact ? 'px-4 pb-3' : 'pt-2'}`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('assistant.disclaimer')}</p>
          <button type="button" onClick={reset} className="shrink-0 text-xs font-bold text-brand-700 hover:underline dark:text-brand-300">
            {t('assistant.clear')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
