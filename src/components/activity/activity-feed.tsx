'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import type { ActivityDTO } from '@/lib/api/types';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

export interface ActivityFeedProps {
  /** Pre-fetched items. When omitted, the feed fetches `/api/activity` itself. */
  items?: ActivityDTO[];
  /** Restrict the self-fetch to a single group, and label rows accordingly. */
  groupId?: string;
  /** Show the "in {group}" context line (default true). */
  showGroup?: boolean;
  className?: string;
}

/** Read the first present string field from an activity's loose data bag. */
function pickString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return undefined;
}

interface MessageSpec {
  key: string;
  needs?: ('description' | 'name')[];
}

const ACTIVITY_MESSAGES: Record<string, MessageSpec> = {
  EXPENSE_ADDED: { key: 'addedExpense', needs: ['description'] },
  EXPENSE_CREATED: { key: 'addedExpense', needs: ['description'] },
  EXPENSE_UPDATED: { key: 'updatedExpense', needs: ['description'] },
  EXPENSE_EDITED: { key: 'updatedExpense', needs: ['description'] },
  EXPENSE_DELETED: { key: 'deletedExpense', needs: ['description'] },
  SETTLEMENT_ADDED: { key: 'addedSettlement' },
  SETTLEMENT_CREATED: { key: 'addedSettlement' },
  PAYMENT_RECORDED: { key: 'addedSettlement' },
  GROUP_CREATED: { key: 'createdGroup' },
  MEMBER_JOINED: { key: 'joinedGroup' },
  MEMBER_INVITED: { key: 'invitedMember', needs: ['name'] },
  INVITE_SENT: { key: 'invitedMember', needs: ['name'] },
  MEMBER_LEFT: { key: 'leftGroup' },
  MEMBER_REMOVED: { key: 'removedMember', needs: ['name'] },
  COMMENT_ADDED: { key: 'addedComment', needs: ['description'] },
  REMINDER_SENT: { key: 'sentReminder' },
};

function ActivityRow({
  item,
  showGroup,
  t,
  tc,
  dateLocale,
}: {
  item: ActivityDTO;
  showGroup: boolean;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  dateLocale: typeof enUS;
}) {
  const actorName = item.actor?.name?.trim() || tc('members');
  const date = new Date(item.createdAt);
  const spec = ACTIVITY_MESSAGES[item.type];

  let sentence: string;
  if (spec) {
    const values: Record<string, string> = { actor: actorName };
    if (spec.needs?.includes('description')) {
      values.description =
        pickString(item.data, ['description', 'expenseDescription']) ?? tc('expense');
    }
    if (spec.needs?.includes('name')) {
      values.name =
        pickString(item.data, ['name', 'memberName', 'displayName', 'email']) ?? tc('members');
    }
    sentence = t(spec.key, values).trim();
  } else {
    sentence = actorName;
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <Avatar name={actorName} image={item.actor?.image} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-pretty text-sm text-content">{sentence}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-content-subtle">
          <time dateTime={item.createdAt}>
            {formatDistanceToNowStrict(date, { addSuffix: true, locale: dateLocale })}
          </time>
          {showGroup && item.groupName ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{t('in', { group: item.groupName })}</span>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function ActivityFeed({ items, groupId, showGroup = true, className }: ActivityFeedProps) {
  const t = useTranslations('activity');
  const tc = useTranslations('common');
  const activeLocale = useLocale();
  const dateLocale = activeLocale === 'de' ? de : enUS;

  const selfFetch = items === undefined;
  const query = useQuery({
    queryKey: ['activity', groupId ?? null],
    queryFn: () =>
      apiFetch<ActivityDTO[]>(
        `/api/activity${groupId ? `?groupId=${encodeURIComponent(groupId)}` : ''}`,
      ),
    enabled: selfFetch,
  });

  const list = items ?? query.data ?? [];

  if (selfFetch && query.isLoading) {
    return (
      <div className={cn('surface-card divide-y divide-hairline', className)}>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (selfFetch && query.isError) {
    return (
      <EmptyState
        icon={<ClockCounterClockwise weight="regular" />}
        title={tc('somethingWentWrong')}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {tc('retry')}
          </Button>
        }
      />
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<ClockCounterClockwise weight="regular" />}
        title={t('noActivity')}
        description={t('noActivityBody')}
      />
    );
  }

  const sorted = [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const days: { key: string; label: string; entries: ActivityDTO[] }[] = [];
  for (const entry of sorted) {
    const date = new Date(entry.createdAt);
    const key = format(date, 'yyyy-MM-dd');
    let bucket = days.find((day) => day.key === key);
    if (!bucket) {
      const label = isToday(date)
        ? t('today')
        : isYesterday(date)
          ? t('yesterday')
          : format(date, 'PP', { locale: dateLocale });
      bucket = { key, label, entries: [] };
      days.push(bucket);
    }
    bucket.entries.push(entry);
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {days.map((day) => (
        <section key={day.key} aria-label={day.label}>
          <h2 className="eyebrow mb-2 px-1">{day.label}</h2>
          <ul className="surface-card divide-y divide-hairline">
            {day.entries.map((entry) => (
              <ActivityRow
                key={entry.id}
                item={entry}
                showGroup={showGroup && !groupId}
                t={t}
                tc={tc}
                dateLocale={dateLocale}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
