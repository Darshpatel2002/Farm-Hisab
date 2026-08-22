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

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || pending) return;

      const history = turns.slice(-HISTORY_LIMIT);
      setTurns((current) => [...current, { role: 'user', text: trimmed }]);
      setPending(true);
      setErrorKey(null);

      try {
        const { data, error } = await supabase.functions.invoke<{ answer?: string; error?: string }>('farm-ai', {
          body: { question: trimmed, history, language: i18n.language === 'gu' ? 'gu' : 'en' },
        });

        if (error) throw error;
        if (!data?.answer) throw new Error(data?.error ?? 'ai_failed');

        setTurns((current) => [...current, { role: 'model', text: data.answer as string }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        setErrorKey(message.includes('not_configured') ? 'assistant.notConfigured' : 'assistant.failed');
      } finally {
        setPending(false);
      }
    },
    [turns, pending, i18n.language],
  );

  const reset = useCallback(() => {
    setTurns([]);
    setErrorKey(null);
  }, []);

  return { turns, pending, errorKey, ask, reset };
}
