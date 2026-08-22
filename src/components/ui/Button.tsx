import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'lg' | 'sm';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-soft hover:from-brand-500 hover:to-brand-700 active:scale-[0.98] disabled:from-brand-600/50 disabled:to-brand-700/50',
  secondary:
    'bg-white/90 text-brand-800 border-2 border-brand-600/80 shadow-sm hover:bg-brand-50 active:scale-[0.98] dark:bg-slate-900/80 dark:text-brand-200 dark:border-brand-500/70 dark:hover:bg-slate-800',
  danger:
    'bg-gradient-to-b from-red-600 to-red-700 text-white shadow-soft hover:from-red-500 hover:to-red-700 active:scale-[0.98] disabled:opacity-60',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-900/5 active:scale-[0.98] dark:text-slate-200 dark:hover:bg-white/10',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-[40px] px-3.5 text-sm',
  md: 'min-h-touch px-5 text-base',
  lg: 'min-h-[56px] px-6 text-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-bold tracking-tight transition
        duration-150 disabled:cursor-not-allowed disabled:opacity-70 ${VARIANTS[variant]} ${SIZES[size]}
        ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Spinner /> : icon}
      <span>{children}</span>
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span
      className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
      role="status"
      aria-label={label ?? 'loading'}
    />
  );
}
