'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

export interface BarChartDatum {
  label: string;
  /** Integer minor units when a currency is provided, otherwise a raw number. */
  value: number;
  /** Optional CSS color for the bar fill (defaults to the brand accent). */
  color?: string;
  /** Optional leading visual rendered before the label (e.g. an avatar/icon). */
  leading?: ReactNode;
}

export interface BarChartProps {
  data: BarChartDatum[];
  /** When set, values are formatted as money in this currency. */
  currency?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Dependency-free horizontal bar list. Each row is a labelled track whose fill
 * width is proportional to the largest value. Bars grow in on mount (disabled
 * under reduced-motion via globals). Exposed to assistive tech as a single
 * image plus a visually-hidden data table.
 */
export function BarChart({ data, currency, className, 'aria-label': ariaLabel }: BarChartProps) {
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const format = (value: number) =>
    currency ? formatMoney(value, currency, locale) : value.toLocaleString(locale);

  const max = Math.max(1, ...data.map((d) => Math.max(0, d.value)));
  const label = ariaLabel ?? 'Bar chart';

  if (data.length === 0) {
    return <div className={cn('h-px w-full', className)} aria-hidden="true" />;
  }

  return (
    <figure className={cn('w-full', className)}>
      <ul role="img" aria-label={label} className="flex flex-col gap-3.5">
        {data.map((datum, index) => {
          const pct = max > 0 ? Math.max(0, (datum.value / max) * 100) : 0;
          return (
            <li key={`${datum.label}-${index}`} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-content">
                  {datum.leading}
                  <span className="truncate">{datum.label}</span>
                </span>
                <span className="tabular shrink-0 font-mono text-content-muted">
                  {format(datum.value)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-700 ease-smooth motion-reduce:transition-none',
                    !datum.color && 'bg-brand',
                  )}
                  style={{
                    width: `${mounted ? pct : 0}%`,
                    backgroundColor: datum.color,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum, index) => (
            <tr key={`${datum.label}-${index}`}>
              <th scope="row">{datum.label}</th>
              <td>{format(datum.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
