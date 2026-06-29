'use client';

import Link from 'next/link';
import { UsersThree } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { GroupSummaryDTO } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/utils/cn';

export interface GroupColorOption {
  key: string;
  /** Solid swatch (used by the color picker). */
  swatch: string;
  /** Tinted tile + foreground (used by the emoji tile). */
  tile: string;
}

/** Preset group accent colors, tuned for equal contrast in light & dark. */
export const GROUP_COLORS: GroupColorOption[] = [
  {
    key: 'emerald',
    swatch: 'bg-emerald-500',
    tile: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  },
  {
    key: 'sky',
    swatch: 'bg-sky-500',
    tile: 'bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  },
  {
    key: 'violet',
    swatch: 'bg-violet-500',
    tile: 'bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  },
  {
    key: 'amber',
    swatch: 'bg-amber-500',
    tile: 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  },
  {
    key: 'rose',
    swatch: 'bg-rose-500',
    tile: 'bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
  },
  {
    key: 'blue',
    swatch: 'bg-blue-500',
    tile: 'bg-blue-500/15 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  },
  {
    key: 'teal',
    swatch: 'bg-teal-500',
    tile: 'bg-teal-500/15 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
  },
  {
    key: 'indigo',
    swatch: 'bg-indigo-500',
    tile: 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
  },
  {
    key: 'fuchsia',
    swatch: 'bg-fuchsia-500',
    tile: 'bg-fuchsia-500/15 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-300',
  },
  {
    key: 'orange',
    swatch: 'bg-orange-500',
    tile: 'bg-orange-500/15 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
  },
];

const DEFAULT_TILE = 'bg-surface-3 text-content-muted';

/** Resolve a stored group color to its tinted tile classes. */
export function groupTileClass(color: string | null | undefined): string {
  return GROUP_COLORS.find((c) => c.key === color)?.tile ?? DEFAULT_TILE;
}

export interface GroupCardProps {
  group: GroupSummaryDTO;
  className?: string;
}

/** Tappable summary card for a group: emoji tile, name, members + your net. */
export function GroupCard({ group, className }: GroupCardProps) {
  const t = useTranslations();
  const settled = group.yourNet === 0;
  const label = settled
    ? t('dashboard.settledUp')
    : group.yourNet > 0
      ? t('dashboard.youAreOwed')
      : t('dashboard.youOwe');

  return (
    <Link
      href={`/groups/${group.id}`}
      className={cn(
        'block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand/55 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        className,
      )}
    >
      <Card interactive className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl leading-none',
              groupTileClass(group.color),
            )}
          >
            {group.emoji ? <span>{group.emoji}</span> : <UsersThree size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-content">{group.name}</h3>
            <p className="mt-0.5 text-xs text-content-muted">
              {t('groups.memberCount', { count: group.memberCount })}
            </p>
          </div>
          {group.archived ? <Badge tone="neutral">{t('groups.archived')}</Badge> : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <span className="text-xs text-content-muted">{label}</span>
          {settled ? (
            <span aria-hidden="true" className="text-sm font-medium text-content-subtle">
              —
            </span>
          ) : (
            <Money
              cents={group.yourNet}
              currency={group.baseCurrency}
              colored
              signed
              className="text-base font-semibold"
            />
          )}
        </div>
      </Card>
    </Link>
  );
}
