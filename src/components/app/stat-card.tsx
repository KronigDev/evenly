'use client';

import { type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/utils/cn';

export type StatTone = 'positive' | 'negative' | 'net';

export interface StatCardProps {
  label: ReactNode;
  /** Value in minor units of `currency`. */
  cents: number;
  currency: string;
  /** `positive`/`negative` force the tint; `net` tints + signs by value sign. */
  tone: StatTone;
  icon?: ReactNode;
  className?: string;
}

const valueToneClass: Record<StatTone, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  net: '',
};

const iconToneClass: Record<StatTone, string> = {
  positive: 'bg-positive/12 text-positive',
  negative: 'bg-negative/12 text-negative',
  net: 'bg-surface-3 text-content-muted',
};

/** Compact dashboard stat: eyebrow label + large mono money value. */
export function StatCard({ label, cents, currency, tone, icon, className }: StatCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-full',
              iconToneClass[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <Money
        cents={cents}
        currency={currency}
        colored={tone === 'net'}
        signed={tone === 'net'}
        className={cn('mt-3 block text-[26px] font-semibold tracking-tight', valueToneClass[tone])}
      />
    </Card>
  );
}
