'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

export interface DonutChartDatum {
  label: string;
  /** Integer minor units when a currency is provided, otherwise a raw number. */
  value: number;
  /** CSS color for the slice + legend swatch. Falls back to a default palette. */
  color?: string;
}

export interface DonutChartProps {
  data: DonutChartDatum[];
  /** When set, values are formatted as money in this currency. */
  currency?: string;
  /** Centre caption under the total (e.g. "Total"). */
  centerLabel?: string;
  className?: string;
  'aria-label'?: string;
}

/** Theme-aware fallback palette used when a slice has no explicit colour. */
const FALLBACK_PALETTE = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#ec4899',
  '#6366f1',
  '#f97316',
  '#0ea5e9',
];

const RADIUS = 42;
const STROKE = 14;
const CIRC = 2 * Math.PI * RADIUS;

export function DonutChart({
  data,
  currency,
  centerLabel,
  className,
  'aria-label': ariaLabel,
}: DonutChartProps) {
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const format = (value: number) =>
    currency ? formatMoney(value, currency, locale) : value.toLocaleString(locale);

  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((sum, d) => sum + d.value, 0);
  const label = ariaLabel ?? 'Donut chart';

  let cumulative = 0;
  const arcs = slices.map((datum, index) => {
    const fraction = total > 0 ? datum.value / total : 0;
    const arc = {
      datum,
      color: datum.color ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length],
      dash: fraction * CIRC,
      offset: -cumulative * CIRC,
      fraction,
    };
    cumulative += fraction;
    return arc;
  });

  return (
    <figure className={cn('flex flex-col items-center gap-6 sm:flex-row sm:gap-8', className)}>
      <div
        role="img"
        aria-label={label}
        className="relative grid shrink-0 place-items-center motion-safe:animate-scale-in"
      >
        <svg viewBox="0 0 100 100" className="h-40 w-40 -rotate-90" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-surface-3"
          />
          {arcs.map((arc, index) => (
            <circle
              key={`${arc.datum.label}-${index}`}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              strokeDasharray={`${mounted ? arc.dash : 0} ${CIRC}`}
              strokeDashoffset={arc.offset}
              className="transition-[stroke-dasharray] duration-700 ease-smooth motion-reduce:transition-none"
            />
          ))}
        </svg>
        <div className="absolute flex flex-col items-center text-center">
          <span className="tabular font-mono text-lg font-semibold text-content">
            {format(total)}
          </span>
          {centerLabel ? <span className="eyebrow mt-0.5">{centerLabel}</span> : null}
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-2.5 motion-safe:animate-fade-up">
        {arcs.map((arc, index) => (
          <li
            key={`${arc.datum.label}-${index}`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: arc.color }}
              />
              <span className="truncate text-content">{arc.datum.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="tabular font-mono text-content-muted">
                {format(arc.datum.value)}
              </span>
              <span className="tabular w-9 text-right text-2xs text-content-subtle">
                {Math.round(arc.fraction * 100)}%
              </span>
            </span>
          </li>
        ))}
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
          {arcs.map((arc, index) => (
            <tr key={`${arc.datum.label}-${index}`}>
              <th scope="row">{arc.datum.label}</th>
              <td>{format(arc.datum.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
