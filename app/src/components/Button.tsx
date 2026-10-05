/**
 * Button — Pulsante coerente per tutto il software
 * Varianti: primary / secondary / danger / success / warning / ghost / purple / indigo
 * Size: xs / sm / md / lg
 * Mobile: full-width (w-full), Desktop: auto-width (w-auto)
 *
 * ButtonLink: stessa grafica, ma renderizzato come <a> per link esterni.
 */
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';

type Variant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'warning'
  | 'ghost'
  | 'purple'
  | 'indigo';

type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
  /** Forza full-width sempre (anche su desktop). Default: w-full sm:w-auto */
  fullWidth?: boolean;
  /** Forza auto-width sempre (anche su mobile). Default: w-full sm:w-auto */
  inline?: boolean;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
  inline?: boolean;
}

const VARIANTI: Record<Variant, string> = {
  primary:
    'bg-apple-blue text-white hover:bg-blue-600 active:bg-blue-700 shadow-apple disabled:bg-blue-300',
  secondary:
    'bg-white text-apple-darkgray border border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50',
  danger:
    'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm disabled:bg-red-300',
  success:
    'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm disabled:bg-green-300',
  warning:
    'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm disabled:bg-amber-300',
  ghost:
    'bg-transparent text-apple-blue hover:bg-blue-50 active:bg-blue-100',
  purple:
    'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 shadow-apple disabled:bg-purple-300',
  indigo:
    'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-apple disabled:bg-indigo-300',
};

const SIZES: Record<Size, string> = {
  xs: 'px-2.5 py-1 text-[11px] rounded-apple',
  sm: 'px-3 py-1.5 text-xs rounded-apple',
  md: 'px-4 py-2.5 text-sm rounded-apple',
  lg: 'px-5 py-3 text-base rounded-apple',
};

function classiBase(
  variant: Variant,
  size: Size,
  fullWidth: boolean,
  inline: boolean,
  className: string
): string {
  const width = fullWidth ? 'w-full' : inline ? 'w-auto' : 'w-full sm:w-auto';
  return [
    'inline-flex items-center justify-center gap-2 font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-60',
    'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-apple-blue/40',
    VARIANTI[variant],
    SIZES[size],
    width,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  fullWidth = false,
  inline = false,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={classiBase(variant, size, fullWidth, inline, className)}
      disabled={disabled}
      {...rest}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  fullWidth = false,
  inline = false,
  className = '',
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={classiBase(variant, size, fullWidth, inline, className)} {...rest}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </a>
  );
}
