'use client';

import { useId, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

const sizeClass = {
  sm: 'h-8 text-xs',
  md: 'h-10 text-sm',
} as const;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const reduce = useReducedMotion();
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 font-medium outline-none transition-colors duration-150 ease-smooth',
              'focus-visible:ring-2 focus-visible:ring-brand/55',
              sizeClass[size],
              active ? 'text-content' : 'text-content-muted hover:text-content',
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                aria-hidden="true"
                className="absolute inset-0 rounded-md border border-hairline bg-surface shadow-soft"
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }
                }
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
