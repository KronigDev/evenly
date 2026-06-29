'use client';

/**
 * Shared query keys, fetch helpers and small utilities for the group-detail
 * feature. Centralising the keys keeps cache invalidation consistent across the
 * expense list, balances, members, settlements, invites and activity panels.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import type { BalanceEntryDTO, ExpenseDTO, MemberDTO } from '@/lib/api/types';

export interface ExpenseFilters {
  q: string;
  category: string;
  memberId: string;
  from: string;
  to: string;
}

export const EMPTY_FILTERS: ExpenseFilters = {
  q: '',
  category: '',
  memberId: '',
  from: '',
  to: '',
};

export interface ExpensesPage {
  expenses: ExpenseDTO[];
  nextCursor: string | null;
}

export const groupKeys = {
  all: (id: string) => ['group', id] as const,
  detail: (id: string) => ['group', id, 'detail'] as const,
  balances: (id: string) => ['group', id, 'balances'] as const,
  expenses: (id: string, filters: ExpenseFilters) => ['group', id, 'expenses', filters] as const,
  settlements: (id: string) => ['group', id, 'settlements'] as const,
  members: (id: string) => ['group', id, 'members'] as const,
  invites: (id: string) => ['group', id, 'invites'] as const,
  activity: (id: string) => ['group', id, 'activity'] as const,
};

export const expenseKeys = {
  detail: (id: string) => ['expense', id] as const,
  comments: (id: string) => ['expense', id, 'comments'] as const,
};

/** Build the querystring for the paginated expenses endpoint. */
export function buildExpensesUrl(
  groupId: string,
  filters: ExpenseFilters,
  cursor: string | null,
  limit = 20,
): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.memberId) params.set('memberId', filters.memberId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return `/api/groups/${groupId}/expenses?${params.toString()}`;
}

/** Invalidate every cached query that belongs to this group. */
export function useInvalidateGroup(groupId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['group', groupId] });
  }, [queryClient, groupId]);
}

export function buildNetMap(net: BalanceEntryDTO[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of net) map.set(entry.memberId, entry.net);
  return map;
}

export function buildMemberMap(members: MemberDTO[]): Map<string, MemberDTO> {
  const map = new Map<string, MemberDTO>();
  for (const member of members) map.set(member.id, member);
  return map;
}

/** Selectable accent tokens for a group's emoji tile. */
export const GROUP_COLORS = [
  'slate',
  'rose',
  'orange',
  'amber',
  'yellow',
  'green',
  'emerald',
  'teal',
  'sky',
  'blue',
  'indigo',
  'violet',
  'fuchsia',
  'pink',
] as const;

export type GroupColor = (typeof GROUP_COLORS)[number];

// Literal class names so Tailwind's JIT compiler keeps them.
const GROUP_TILE_CLASS: Record<GroupColor, string> = {
  slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-200',
  rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-200',
  orange: 'bg-orange-500/15 text-orange-700 dark:text-orange-200',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-200',
  yellow: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-200',
  green: 'bg-green-500/15 text-green-700 dark:text-green-200',
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200',
  teal: 'bg-teal-500/15 text-teal-700 dark:text-teal-200',
  sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-200',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-200',
  indigo: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-200',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-200',
  fuchsia: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-200',
  pink: 'bg-pink-500/15 text-pink-700 dark:text-pink-200',
};

const GROUP_SWATCH_CLASS: Record<GroupColor, string> = {
  slate: 'bg-slate-500',
  rose: 'bg-rose-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  sky: 'bg-sky-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  fuchsia: 'bg-fuchsia-500',
  pink: 'bg-pink-500',
};

function isGroupColor(value: string | null): value is GroupColor {
  return value !== null && (GROUP_COLORS as readonly string[]).includes(value);
}

/** Tile (tinted bg + text) class for a group's accent token. */
export function groupTileClass(color: string | null): string {
  return isGroupColor(color) ? GROUP_TILE_CLASS[color] : GROUP_TILE_CLASS.slate;
}

/** Solid swatch class for a group's accent token (used in the colour picker). */
export function groupSwatchClass(color: GroupColor): string {
  return GROUP_SWATCH_CLASS[color];
}

/** Programmatically trigger a file download (the endpoint sets the headers). */
export function triggerDownload(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** Locale-aware relative time formatter, e.g. "3 days ago". */
export function useRelativeTime(): (iso: string) => string {
  const locale = useLocale();
  return useCallback(
    (iso: string) => {
      const dfLocale = locale.startsWith('de') ? de : enUS;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      return formatDistanceToNow(date, { addSuffix: true, locale: dfLocale });
    },
    [locale],
  );
}
