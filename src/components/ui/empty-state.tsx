import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
    >
      {icon ? (
        <div className="border-hairline bg-surface-2 text-content-muted mb-4 grid h-14 w-14 place-items-center rounded-2xl border">
          {icon}
        </div>
      ) : null}
      <h3 className="text-content text-base font-semibold">{title}</h3>
      {description ? (
        <p className="text-content-muted mt-1.5 max-w-sm text-sm text-pretty">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
