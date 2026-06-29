'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

export interface AuthCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Optional content rendered in a hairline-separated footer (e.g. links). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Presentational shell for an auth form: a refined surface card with a title,
 * optional subtitle, body slot and an optional footer. Layout-only — all
 * behaviour lives in the page that renders it.
 */
export function AuthCard({ title, subtitle, children, footer, className }: AuthCardProps) {
  return (
    <Card className={cn('rounded-2xl p-7 shadow-card sm:p-8', className)}>
      <header className="space-y-2">
        <h1 className="text-balance text-xl font-semibold tracking-tight text-content">{title}</h1>
        {subtitle ? (
          <p className="text-pretty text-sm leading-relaxed text-content-muted">{subtitle}</p>
        ) : null}
      </header>
      <div className="mt-6">{children}</div>
      {footer ? (
        <footer className="mt-6 border-t border-hairline pt-5 text-center text-sm text-content-muted">
          {footer}
        </footer>
      ) : null}
    </Card>
  );
}

/** Loading placeholder used as a Suspense fallback while search params resolve. */
export function AuthCardFallback() {
  return (
    <div className="surface-card rounded-2xl p-7 shadow-card sm:p-8" aria-hidden="true">
      <div className="space-y-3">
        <div className="skeleton h-6 w-1/2" />
        <div className="skeleton h-4 w-3/4" />
      </div>
      <div className="mt-7 space-y-4">
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-12 w-full" />
      </div>
    </div>
  );
}
