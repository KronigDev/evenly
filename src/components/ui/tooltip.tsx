'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

const sidePositionClass: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

function offsetFor(side: TooltipSide, reduce: boolean): { x: number; y: number } {
  if (reduce) return { x: 0, y: 0 };
  if (side === 'top') return { x: 0, y: 4 };
  if (side === 'bottom') return { x: 0, y: -4 };
  if (side === 'left') return { x: 4, y: 0 };
  return { x: -4, y: 0 };
}

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  delay?: number;
  className?: string;
}

export function Tooltip({ content, children, side = 'top', delay = 350, className }: TooltipProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function show(immediate = false) {
    clearTimer();
    if (immediate || delay <= 0) {
      setOpen(true);
    } else {
      timerRef.current = window.setTimeout(() => setOpen(true), delay);
    }
  }

  function hide() {
    clearTimer();
    setOpen(false);
  }

  useEffect(() => () => clearTimer(), []);

  const offset = offsetFor(side, Boolean(reduce));

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => show()}
      onMouseLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      <span aria-describedby={open ? tooltipId : undefined} className="inline-flex">
        {children}
      </span>
      <AnimatePresence>
        {open ? (
          <motion.span
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0, ...offset }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, ...offset }}
            transition={{ duration: reduce ? 0 : 0.14, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-ink-on shadow-pop',
              sidePositionClass[side],
              className,
            )}
          >
            {content}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
