import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export type BadgeTone = 'neutral' | 'brand' | 'positive' | 'negative' | 'warning' | 'info';

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-content-muted',
  brand: 'bg-brand/12 text-brand',
  positive: 'bg-positive/12 text-positive',
  negative: 'bg-negative/12 text-negative',
  warning: 'bg-warning/12 text-warning',
  info: 'bg-info/12 text-info',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
