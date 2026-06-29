'use client';

import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils/cn';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Shared base classes for buttons and icon-buttons. */
export const buttonBaseClass =
  'relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium outline-none transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-smooth active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand/55 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-55';

export const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-ink-on shadow-soft hover:bg-ink/90',
  secondary: 'border border-hairline bg-surface-2 text-content shadow-soft hover:bg-surface-3',
  ghost: 'bg-transparent text-content hover:bg-surface-2',
  outline: 'border border-hairline-strong bg-transparent text-content hover:bg-surface-2',
  danger: 'bg-negative text-ink-on shadow-soft hover:bg-negative/90',
};

const buttonSizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-md px-3 text-sm',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-12 gap-2 rounded-lg px-5 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  /** Render the single child element with the button styles merged in. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    asChild = false,
    className,
    children,
    disabled,
    type,
    ...props
  },
  ref,
) {
  const classes = cn(
    buttonBaseClass,
    buttonVariantClass[variant],
    buttonSizeClass[size],
    fullWidth && 'w-full',
    className,
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, { className: cn(classes, child.props.className) });
  }

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={size === 'lg' ? 'sm' : 'xs'} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
