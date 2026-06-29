'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name: string;
  image?: string | null;
  size?: AvatarSize;
  className?: string;
}

const sizeClass: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

/** Deterministic pastel pairs that read well in both light and dark themes. */
const PALETTE = [
  'bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200',
  'bg-orange-500/15 text-orange-700 dark:bg-orange-400/15 dark:text-orange-200',
  'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200',
  'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200',
  'bg-teal-500/15 text-teal-700 dark:bg-teal-400/15 dark:text-teal-200',
  'bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200',
  'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200',
  'bg-fuchsia-500/15 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-200',
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const result = (first + last).toUpperCase();
  return result.length > 0 ? result : '?';
}

export function Avatar({ name, image, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const palette = PALETTE[hashString(name) % PALETTE.length] ?? PALETTE[0];
  const showImage = Boolean(image) && !failed;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium ring-1 ring-black/[0.04] select-none dark:ring-white/[0.06]',
        sizeClass[size],
        !showImage && palette,
        className,
      )}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
