'use client';

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Disable closing on overlay click / Esc (e.g. while a mutation is pending). */
  dismissible?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  dismissible = true,
  ...aria
}: DialogProps) {
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

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            aria-hidden="true"
            className="bg-ink/40 absolute inset-0 backdrop-blur-[2px]"
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
              'border-hairline bg-surface shadow-pop relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden border outline-none',
              'rounded-2xl max-sm:rounded-b-none sm:max-w-lg',
              className,
            )}
            initial={{ opacity: 0, y: reduce ? 0 : 24, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : 24, scale: reduce ? 1 : 0.98 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
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

/** Alias kept for call-sites that prefer the `Modal` name. */
export const Modal = Dialog;

export interface DialogHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function DialogHeader({ title, description, onClose, className }: DialogHeaderProps) {
  return (
    <div className={cn('border-hairline flex items-start gap-3 border-b px-5 py-4', className)}>
      <div className="min-w-0 flex-1">
        <h2 className="text-content text-base font-semibold">{title}</h2>
        {description ? (
          <p className="text-content-muted mt-1 text-sm text-pretty">{description}</p>
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

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-5 py-4', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-hairline flex items-center justify-end gap-2 border-t px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}
