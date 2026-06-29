'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

/** Shared field styling for `Input`, `Textarea` and `Select`. */
export const controlBaseClass =
  'w-full rounded-lg border border-hairline bg-surface text-sm text-content shadow-soft outline-none transition-[border-color,box-shadow] duration-150 ease-smooth placeholder:text-content-subtle focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-negative aria-[invalid=true]:focus-visible:border-negative aria-[invalid=true]:focus-visible:ring-negative/30';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(controlBaseClass, 'h-10 px-3', className)}
      {...props}
    />
  );
});
