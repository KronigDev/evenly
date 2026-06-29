'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned action(s), e.g. a primary button. */
  action?: ReactNode;
  /** Alias for {@link PageHeaderProps.action}. */
  actions?: ReactNode;
  className?: string;
}

/** Reusable page title block: large tracking-tight title + optional action. */
export function PageHeader({ title, description, action, actions, className }: PageHeaderProps) {
  const trailing = action ?? actions;
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-content sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-pretty text-sm text-content-muted">{description}</p>
        ) : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
