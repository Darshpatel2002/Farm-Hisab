import { useCallback, useState } from 'react';
import type { ZodTypeAny, z } from 'zod';
import { fieldErrors } from '../../lib/validation/schemas';

/** Minimal form state + Zod validation, shared by every form in the app. */
export function useZodForm<S extends ZodTypeAny>(schema: S, initialValues: Record<string, unknown>) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = useCallback((name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  const reset = useCallback(
    (next?: Record<string, unknown>) => {
      setValues(next ?? initialValues);
      setErrors({});
    },
    [initialValues],
  );

  const validate = useCallback((): { success: true; data: z.infer<S> } | { success: false } => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return { success: true, data: result.data as z.infer<S> };
    }
    setErrors(fieldErrors(result.error));
    return { success: false };
  }, [schema, values]);

  return { values, errors, setErrors, setField, setValues, reset, validate };
}

/** Reads a form value as a string for controlled inputs. */
export function str(values: Record<string, unknown>, key: string): string {
  const value = values[key];
  if (value === null || value === undefined) return '';
  return String(value);
}

export function bool(values: Record<string, unknown>, key: string): boolean {
  return Boolean(values[key]);
}

/** Converts empty strings to null so PostgreSQL receives proper NULLs. */
export function emptyToNull<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = value === '' ? null : value;
  }
  return output as T;
}
