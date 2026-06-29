'use client';

import { useLocale } from 'next-intl';
import { formatMoney, type Cents } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

export interface MoneyProps {
  cents: Cents;
  currency: string;
  locale?: string;
  /** Tint by sign: positive→positive, negative→negative, zero→muted. */
  colored?: boolean;
  /** Prefix an explicit +/- sign. */
  signed?: boolean;
  className?: string;
}

export function Money({ cents, currency, locale, colored, signed, className }: MoneyProps) {
  const activeLocale = useLocale();
  const resolvedLocale = locale ?? activeLocale;

  const formatted = signed
    ? formatMoney(Math.abs(cents), currency, resolvedLocale)
    : formatMoney(cents, currency, resolvedLocale);
  const prefix = signed ? (cents > 0 ? '+' : cents < 0 ? '-' : '') : '';

  const colorClass = colored
    ? cents > 0
      ? 'text-positive'
      : cents < 0
        ? 'text-negative'
        : 'text-content-muted'
    : undefined;

  return (
    <span className={cn('tabular font-mono', colorClass, className)}>
      {prefix}
      {formatted}
    </span>
  );
}
