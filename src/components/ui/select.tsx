'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';
import { controlBaseClass } from './input';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlBaseClass, 'h-10 cursor-pointer appearance-none pr-9 pl-3', className)}
        {...props}
      >
        {children}
      </select>
      <CaretDown
        size={16}
        weight="bold"
        aria-hidden="true"
        className="text-content-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </div>
  );
});
