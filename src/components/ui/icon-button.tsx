'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { buttonBaseClass, buttonVariantClass, type ButtonVariant, type ButtonSize } from './button';

const iconSizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 rounded-md text-base',
  md: 'h-10 w-10 rounded-lg text-lg',
  lg: 'h-12 w-12 rounded-lg text-xl',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name — rendered as `aria-label`. */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        buttonBaseClass,
        buttonVariantClass[variant],
        iconSizeClass[size],
        'shrink-0',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
