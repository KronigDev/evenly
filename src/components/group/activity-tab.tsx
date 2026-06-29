'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api/client';
import type { ActivityDTO } from '@/lib/api/types';
import { groupKeys, useRelativeTime } from './queries';

/** Maps an ActivityType enum value to its i18n key + the placeholders it needs. */
const ACTIVITY_MAP: Record<string, { key: string; name?: boolean; description?: boolean }> = {
  GROUP_CREATED: { key: 'createdGroup' },
  GROUP_UPDATED: { key: 'updatedGroup' },
  GROUP_ARCHIVED: { key: 'archivedGroup' },
  MEMBER_INVITED: { key: 'invitedMember', name: true },
  MEMBER_JOINED: { key: 'joinedGroup' },
  MEMBER_REMOVED: { key: 'removedMember', name: true },
  MEMBER_LEFT: { key: 'leftGroup' },
  EXPENSE_ADDED: { key: 'addedExpense', description: true },
  EXPENSE_UPDATED: { key: 'updatedExpense', description: true },
  EXPENSE_DELETED: { key: 'deletedExpense', description: true },
  SETTLEMENT_ADDED: { key: 'addedSettlement' },
  SETTLEMENT_DELETED: { key: 'deletedSettlement' },
  COMMENT_ADDED: { key: 'addedComment', description: true },
  REMINDER_SENT: { key: 'sentReminder' },
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface ActivityTabProps {
  groupId: string;
}

export function ActivityTab({ groupId }: ActivityTabProps) {
  const t = useTranslations('activity');
  const tc = useTranslations('common');
  const relative = useRelativeTime();

  const query = useQuery({
    queryKey: groupKeys.activity(groupId),
    queryFn: ({ signal }) =>
      apiFetch<ActivityDTO[]>(`/api/activity?groupId=${groupId}`, { signal }),
  });

  function sentence(activity: ActivityDTO): string {
    const actor = activity.actor?.name ?? tc('none');
    const config = ACTIVITY_MAP[activity.type];
    if (!config) return actor;
    const values: Record<string, string> = { actor };
    if (config.name) values.name = asString(activity.data.name);
    if (config.description) values.description = asString(activity.data.description);
    return t(config.key, values);
  }

  if (query.isLoading) {
    return (
      <Card className="overflow-hidden">
        <ul className="divide-hairline divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-1/5" />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <EmptyState
          icon={<ClockCounterClockwise size={26} />}
          title={tc('somethingWentWrong')}
          action={
            <Button variant="secondary" onClick={() => query.refetch()}>
              {tc('retry')}
            </Button>
          }
        />
      </Card>
    );
  }

  const items = query.data ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ClockCounterClockwise size={26} />}
          title={t('noActivity')}
          description={t('noActivityBody')}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-hairline divide-y">
        {items.map((activity) => (
          <li key={activity.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar
              name={activity.actor?.name ?? '?'}
              image={activity.actor?.image ?? null}
              size="sm"
            />
            <p className="text-content min-w-0 flex-1 text-sm">{sentence(activity)}</p>
            <span className="text-content-subtle shrink-0 text-xs">
              {relative(activity.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
