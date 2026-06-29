'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle, Info, WarningCircle, X, XCircle } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';

export type ToastTone = 'success' | 'error' | 'info' | 'message' | 'warning';

export interface ToastOptions {
  description?: ReactNode;
  /** Auto-dismiss delay in ms; pass 0 to disable auto-dismiss. */
  duration?: number;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: ReactNode;
  description?: ReactNode;
  duration: number;
}

type ToastFn = (message: ReactNode, options?: ToastOptions) => number;

export interface ToastApi {
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  warning: ToastFn;
  message: ToastFn;
  dismiss: (id: number) => void;
}

interface ToastContextValue {
  toast: ToastApi;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

const toneConfig: Record<ToastTone, { icon: Icon | null; className: string }> = {
  success: { icon: CheckCircle, className: 'text-positive' },
  error: { icon: XCircle, className: 'text-negative' },
  warning: { icon: WarningCircle, className: 'text-warning' },
  info: { icon: Info, className: 'text-info' },
  message: { icon: null, className: 'text-content-muted' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: ReactNode, options?: ToastOptions): number => {
      idRef.current += 1;
      const id = idRef.current;
      const duration = options?.duration ?? DEFAULT_DURATION;
      setToasts((current) => [
        ...current,
        { id, tone, message, description: options?.description, duration },
      ]);
      return id;
    },
    [],
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      info: (message, options) => push('info', message, options),
      warning: (message, options) => push('warning', message, options),
      message: (message, options) => push('message', message, options),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:w-[22rem] sm:items-end"
              role="region"
              aria-label="Notifications"
            >
              <AnimatePresence initial={false}>
                {toasts.map((toast) => (
                  <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
                ))}
              </AnimatePresence>
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const reduce = useReducedMotion();
  const config = toneConfig[toast.tone];
  const IconComponent = config.icon;

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <motion.div
      layout
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.97 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="border-hairline bg-surface shadow-pop pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 sm:w-[22rem]"
    >
      {IconComponent ? (
        <IconComponent
          size={20}
          weight="fill"
          className={cn('mt-0.5 shrink-0', config.className)}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-content text-sm font-medium">{toast.message}</p>
        {toast.description ? (
          <p className="text-content-muted mt-0.5 text-xs">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="text-content-subtle hover:bg-surface-2 hover:text-content focus-visible:ring-brand/55 -mt-0.5 -mr-1 shrink-0 rounded-md p-1 transition-colors outline-none focus-visible:ring-2"
      >
        <X size={15} />
      </button>
    </motion.div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>.');
  return ctx;
}
