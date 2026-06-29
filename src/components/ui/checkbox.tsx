'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Optional inline label rendered next to the box. */
  label?: ReactNode;
  /** Class applied to the outer label wrapper. */
  wrapperClassName?: string;
}

/**
 * Custom checkbox built on a visually-hidden native input so it stays fully
 * keyboard accessible while we render the styled box + Phosphor check mark.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, wrapperClassName, disabled, ...props },
  ref,
) {
  return (
    <label
      className={cn(
        'text-content inline-flex cursor-pointer items-center gap-2 text-sm',
        disabled && 'cursor-not-allowed opacity-60',
        wrapperClassName,
      )}
    >
      <input ref={ref} type="checkbox" disabled={disabled} className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className={cn(
          'border-hairline-strong bg-surface text-ink-on shadow-soft ease-smooth grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors duration-150',
          'peer-checked:border-ink peer-checked:bg-ink',
          'peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100',
          'peer-focus-visible:ring-brand/55 peer-focus-visible:ring-offset-canvas peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
          className,
        )}
      >
        <Check
          size={12}
          weight="bold"
          className="ease-smooth scale-75 opacity-0 transition duration-150"
        />
      </span>
      {label ? <span className="select-none">{label}</span> : null}
    </label>
  );
});
