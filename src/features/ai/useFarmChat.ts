import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase/client';

/**
 * Chat with the farm assistant.
 *
 * The question is sent to the `farm-ai` Edge Function, which reads the
 * farmer's own records under RLS and asks Gemini. No API key ever reaches
 * the browser.
 */

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

const HISTORY_LIMIT = 10;

export function useFarmChat() {
  const { i18n } = useTranslation();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || pending) return;

      const history = turns.slice(-HISTORY_LIMIT);
      setTurns((current) => [...current, { role: 'user', text: trimmed }]);
      setPending(true);
      setErrorKey(null);
      setErrorDetail(null);

      try {
        const { data, error } = await supabase.functions.invoke<{ answer?: string; error?: string; detail?: string }>(
          'farm-ai',
          { body: { question: trimmed, history, language: i18n.language === 'gu' ? 'gu' : 'en' } },
        );

        // A non-2xx reply still carries our JSON body, so read it for the reason.
        let payload = data ?? null;
        if (error && 'context' in error) {
          const response = (error as { context?: Response }).context;
          if (response && typeof response.json === 'function') {
            payload = await response.json().catch(() => null);
          }
        }

        if (payload?.answer) {
          setTurns((current) => [...current, { role: 'model', text: payload.answer as string }]);
          return;
        }

        const reason = payload?.error ?? (error instanceof Error ? error.message : 'ai_failed');
        if (payload?.detail) console.error('farm-ai:', payload.detail);
        setErrorKey(reason === 'not_configured' ? 'assistant.notConfigured' : 'assistant.failed');
        setErrorDetail(payload?.detail ?? null);
      } catch (error) {
        setErrorKey('assistant.failed');
        setErrorDetail(error instanceof Error ? error.message : null);
      } finally {
        setPending(false);
      }
    },
    [turns, pending, i18n.language],
  );

  const reset = useCallback(() => {
    setTurns([]);
    setErrorKey(null);
    setErrorDetail(null);
  }, []);

  return { turns, pending, errorKey, errorDetail, ask, reset };
}
