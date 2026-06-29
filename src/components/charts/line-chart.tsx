'use client';

import { useEffect, useId, useState } from 'react';
import { useLocale } from 'next-intl';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

export interface LineChartDatum {
  label: string;
  /** Integer minor units when a currency is provided, otherwise a raw number. */
  value: number;
}

export interface LineChartProps {
  data: LineChartDatum[];
  /** When set, values are formatted as money in this currency. */
  currency?: string;
  className?: string;
  'aria-label'?: string;
}

const VIEW_W = 100;
const VIEW_H = 40;
const PAD_TOP = 5;

/**
 * Dependency-free area + line chart drawn in a normalized SVG viewBox that
 * stretches to fill its container (constant stroke width via
 * `vector-effect`). The line draws itself in on mount; the trailing marker and
 * axis labels are HTML so they stay crisp and undistorted.
 */
export function LineChart({ data, currency, className, 'aria-label': ariaLabel }: LineChartProps) {
  const locale = useLocale();
  const gradientId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const format = (value: number) =>
    currency ? formatMoney(value, currency, locale) : value.toLocaleString(locale);

  const label = ariaLabel ?? 'Line chart';
  const max = Math.max(1, ...data.map((d) => Math.max(0, d.value)));

  const points = data.map((datum, index) => {
    const x = data.length > 1 ? (index / (data.length - 1)) * VIEW_W : VIEW_W / 2;
    const usableH = VIEW_H - PAD_TOP;
    const y = VIEW_H - (Math.max(0, datum.value) / max) * usableH;
    return { x, y, datum };
  });

  const first = points[0];
  const last = points[points.length - 1];

  const linePath = points
    .map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const areaPath =
    points.length >= 2 && first && last
      ? `M ${first.x.toFixed(2)} ${VIEW_H} ` +
        points.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
        ` L ${last.x.toFixed(2)} ${VIEW_H} Z`
      : '';

  // Sparse axis labels: every label when few, otherwise first / middle / last.
  const tickIndices =
    data.length <= 4
      ? data.map((_, index) => index)
      : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  if (data.length === 0) {
    return <div className={cn('h-px w-full', className)} aria-hidden="true" />;
  }

  return (
    <figure className={cn('text-brand w-full', className)}>
      <div className="relative w-full">
        <svg
          role="img"
          aria-label={label}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-44 w-full overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {areaPath ? (
            <path
              d={areaPath}
              fill={`url(#${gradientId})`}
              className="ease-smooth opacity-0 transition-opacity duration-700 motion-reduce:opacity-100 motion-reduce:transition-none"
              style={{ opacity: mounted ? 1 : undefined }}
            />
          ) : null}
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={mounted ? 0 : 100}
            className="ease-smooth transition-[stroke-dashoffset] duration-[900ms] motion-reduce:transition-none"
          />
        </svg>
        {last ? (
          <span
            aria-hidden="true"
            className="bg-brand ring-surface pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
            style={{ left: `${last.x}%`, top: `${(last.y / VIEW_H) * 100}%` }}
          />
        ) : null}
      </div>

      <div className="text-2xs text-content-subtle mt-2 flex justify-between gap-2">
        {tickIndices.map((tickIndex) => {
          const point = data[tickIndex];
          return (
            <span key={tickIndex} className="truncate">
              {point?.label ?? ''}
            </span>
          );
        })}
      </div>

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
