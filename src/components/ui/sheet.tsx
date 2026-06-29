'use client';

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type Target } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';
import { IconButton } from './icon-button';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null,
  );
}

export type SheetSide = 'right' | 'left' | 'bottom';

const sidePositionClass: Record<SheetSide, string> = {
  right: 'inset-y-0 right-0 h-full w-full max-w-md rounded-l-2xl border-l',
  left: 'inset-y-0 left-0 h-full w-full max-w-md rounded-r-2xl border-r',
  bottom: 'inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl border-t',
};

function hiddenTarget(side: SheetSide, reduce: boolean): Target {
  if (reduce) return { opacity: 0 };
  if (side === 'right') return { x: '100%' };
  if (side === 'left') return { x: '-100%' };
  return { y: '100%' };
}

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: SheetSide;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function Sheet({
  open,
  onOpenChange,
  side = 'right',
  children,
  className,
  dismissible = true,
  ...aria
}: SheetProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    window.setTimeout(() => {
      const focusables = panel ? getFocusable(panel) : [];
      (focusables[0] ?? panel)?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onOpenChange(false);
        return;
      }
      if (event.key === 'Tab' && panel) {
        const focusables = getFocusable(panel);
        if (focusables.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onOpenChange, dismissible]);

  if (!mounted) return null;

  const hidden = hiddenTarget(side, Boolean(reduce));

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={() => dismissible && onOpenChange(false)}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={cn(
              'absolute z-10 flex flex-col overflow-hidden border-hairline bg-surface shadow-pop outline-none',
              sidePositionClass[side],
              className,
            )}
            initial={hidden}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={hidden}
            transition={{ duration: reduce ? 0 : 0.3, ease: [0.32, 0.72, 0, 1] }}
            {...aria}
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export interface SheetHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function SheetHeader({ title, description, onClose, className }: SheetHeaderProps) {
  return (
    <div className={cn('flex items-start gap-3 border-b border-hairline px-5 py-4', className)}>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-content">{title}</h2>
        {description ? (
          <p className="mt-1 text-pretty text-sm text-content-muted">{description}</p>
        ) : null}
      </div>
      {onClose ? (
        <IconButton label="Close" size="sm" variant="ghost" onClick={onClose} className="-mr-1.5">
          <X size={18} />
        </IconButton>
      ) : null}
    </div>
  );
}

export function SheetBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-5 py-4', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-hairline px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}
