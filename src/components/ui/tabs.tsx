'use client';

import { useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils/cn';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface TabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  items: TabItem<T>[];
  className?: string;
  'aria-label'?: string;
}

export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
  'aria-label': ariaLabel,
}: TabsProps<T>) {
  const reduce = useReducedMotion();
  const layoutId = useId();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  function focusTab(index: number) {
    const item = items[index];
    if (!item) return;
    onValueChange(item.value);
    buttonsRef.current[index]?.focus();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusTab((index + 1) % items.length);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusTab((index - 1 + items.length) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(items.length - 1);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('border-hairline flex items-center gap-1 border-b', className)}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'ease-smooth focus-visible:ring-brand/55 relative -mb-px inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors duration-150 outline-none focus-visible:rounded-md focus-visible:ring-2',
              active ? 'text-content' : 'text-content-muted hover:text-content',
            )}
          >
            {item.icon}
            {item.label}
            {active ? (
              <motion.span
                layoutId={layoutId}
                aria-hidden="true"
                className="bg-ink absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }
                }
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
