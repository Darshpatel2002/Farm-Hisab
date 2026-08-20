import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Accessible form primitives.
 * Every control is label-linked, announces its own error and is at least
 * 48px tall so it is comfortable on a phone.
 */

interface FieldShellProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldShellProps) {
  const { t } = useTranslation();
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="mb-4">
      <label className="label" htmlFor={id}>
        {label}
        {required ? <span className="text-red-700 dark:text-red-400"> *</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm font-semibold text-red-700 dark:text-red-400">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

export function TextField({ label, error, hint, required, ...rest }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          id={id}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={`input ${invalid ? 'input-error' : ''}`}
        />
      )}
    </Field>
  );
}

interface NumberFieldProps extends Omit<TextFieldProps, 'type'> {
  /** Shown before the value, e.g. the currency symbol. */
  prefix?: string;
  suffix?: string;
}

export function NumberField({ label, error, hint, required, prefix, suffix, ...rest }: NumberFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <div className="flex items-stretch">
          {prefix ? (
            <span className="flex min-h-touch items-center rounded-l-xl border-2 border-r-0 border-slate-300 bg-slate-50 px-3 text-base font-semibold dark:border-slate-700 dark:bg-slate-800">
              {prefix}
            </span>
          ) : null}
          <input
            {...rest}
            id={id}
            type="number"
            /* decimal keypad on Android */
            inputMode="decimal"
            step={rest.step ?? 'any'}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={`input ${prefix ? 'rounded-l-none' : ''} ${suffix ? 'rounded-r-none' : ''} ${invalid ? 'input-error' : ''}`}
          />
          {suffix ? (
            <span className="flex min-h-touch items-center rounded-r-xl border-2 border-l-0 border-slate-300 bg-slate-50 px-3 text-base font-semibold dark:border-slate-700 dark:bg-slate-800">
              {suffix}
            </span>
          ) : null}
        </div>
      )}
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: Option[];
  error?: string | undefined;
  hint?: string | undefined;
  placeholder?: string;
}

export function SelectField({ label, options, error, hint, required, placeholder, ...rest }: SelectFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <select
          {...rest}
          id={id}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={`input ${invalid ? 'input-error' : ''}`}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

export function TextAreaField({ label, error, hint, required, ...rest }: TextAreaProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          id={id}
          rows={rest.rows ?? 3}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={`input ${invalid ? 'input-error' : ''}`}
        />
      )}
    </Field>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="mb-4 flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-6 w-6 rounded border-2 border-slate-400 text-brand-700 focus:ring-brand-500"
      />
      <label htmlFor={id} className="text-base font-medium text-slate-800 dark:text-slate-200">
        {label}
        {hint ? <span className="block text-sm font-normal text-slate-600 dark:text-slate-400">{hint}</span> : null}
      </label>
    </div>
  );
}
