'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowsLeftRight,
  ArrowUpRight,
  ClockCounterClockwise,
  Plus,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import type { ActivityDTO, DashboardDTO } from '@/lib/api/types';
import { GroupCard } from '@/components/app/group-card';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { useUser } from '@/components/app/user-context';
import { CreateGroupDialog } from '@/components/groups/create-group-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

/** Maps activity `type` values to their `activity.*` i18n message keys. */
const ACTIVITY_MESSAGE_KEY: Record<string, string> = {
  EXPENSE_ADDED: 'addedExpense',
  EXPENSE_UPDATED: 'updatedExpense',
  EXPENSE_DELETED: 'deletedExpense',
  SETTLEMENT_ADDED: 'addedSettlement',
  GROUP_CREATED: 'createdGroup',
  MEMBER_INVITED: 'invitedMember',
  MEMBER_JOINED: 'joinedGroup',
  MEMBER_LEFT: 'leftGroup',
  MEMBER_REMOVED: 'removedMember',
  COMMENT_ADDED: 'addedComment',
  REMINDER_SENT: 'sentReminder',
};

function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-content text-lg font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

function LoadErrorState({ onRetry }: { onRetry: () => void }) {
  const tc = useTranslations('common');
  return (
    <EmptyState
      className="surface-card"
      icon={<WarningCircle size={26} />}
      title={tc('somethingWentWrong')}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {tc('retry')}
        </Button>
      }
    />
  );
}

function ActivityRow({ activity }: { activity: ActivityDTO }) {
  const ta = useTranslations('activity');
  const locale = useLocale();

  const key = ACTIVITY_MESSAGE_KEY[activity.type];
  const actor = activity.actor?.name ?? '';
  const description =
    typeof activity.data.description === 'string' ? activity.data.description : '';
  const name = typeof activity.data.name === 'string' ? activity.data.name : '';
  const text = key ? ta(key, { actor, description, name }) : actor;
  const relative = formatDistanceToNow(new Date(activity.createdAt), {
    addSuffix: true,
    locale: locale === 'de' ? de : enUS,
  });

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar name={actor || '?'} image={activity.actor?.image ?? null} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-content truncate text-sm">{text}</p>
        <p className="text-content-subtle truncate text-xs">
          {relative}
          {activity.groupName ? ` · ${ta('in', { group: activity.groupName })}` : ''}
        </p>
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const t = useTranslations('dashboard');
  const tg = useTranslations('groups');
  const ta = useTranslations('activity');
  const te = useTranslations('errors');
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => apiFetch<DashboardDTO>('/api/dashboard', { signal }),
  });
  const activityQuery = useQuery({
    queryKey: ['activity'],
    queryFn: ({ signal }) => apiFetch<ActivityDTO[]>('/api/activity', { signal }),
  });

  useEffect(() => {
    if (dashboardQuery.isError) toast.error(te('generic'));
  }, [dashboardQuery.isError, toast, te]);
  useEffect(() => {
    if (activityQuery.isError) toast.error(te('generic'));
  }, [activityQuery.isError, toast, te]);

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const dash = dashboardQuery.data;
  const recent = (activityQuery.data ?? []).slice(0, 6);

  return (
    <div className="animate-fade-up space-y-10">
      <PageHeader title={t('greeting', { name: firstName })} />

      {dashboardQuery.isError ? (
        <LoadErrorState onRetry={() => void dashboardQuery.refetch()} />
      ) : (
        <>
          <section aria-label={t('totalBalance')} className="grid gap-4 sm:grid-cols-3">
            {dashboardQuery.isLoading || !dash ? (
              [0, 1, 2].map((i) => (
                <Card key={i} className="p-5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-4 h-7 w-28" />
                </Card>
              ))
            ) : (
              <>
                <StatCard
                  label={t('youAreOwed')}
                  cents={dash.totalOwed}
                  currency={dash.currency}
                  tone="positive"
                  icon={<ArrowDownLeft size={18} />}
                />
                <StatCard
                  label={t('youOwe')}
                  cents={dash.totalOwe}
                  currency={dash.currency}
                  tone="negative"
                  icon={<ArrowUpRight size={18} />}
                />
                <StatCard
                  label={t('netBalance')}
                  cents={dash.net}
                  currency={dash.currency}
                  tone="net"
                  icon={<ArrowsLeftRight size={18} />}
                />
              </>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading
              title={t('yourGroups')}
              action={
                dash && dash.groups.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Plus size={16} weight="bold" />}
                    onClick={() => setCreateOpen(true)}
                  >
                    {tg('newGroup')}
                  </Button>
                ) : null
              }
            />
            {dashboardQuery.isLoading || !dash ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="h-32 p-4">
                    <Skeleton className="h-11 w-11 rounded-xl" />
                    <Skeleton className="mt-3 h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </Card>
                ))}
              </div>
            ) : dash.groups.length === 0 ? (
              <EmptyState
                className="surface-card"
                icon={<UsersThree size={26} />}
                title={t('noGroups')}
                description={t('noGroupsBody')}
                action={
                  <Button
                    leftIcon={<Plus size={18} weight="bold" />}
                    onClick={() => setCreateOpen(true)}
                  >
                    {t('createFirstGroup')}
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dash.groups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="space-y-4">
        <SectionHeading
          title={t('recentActivity')}
          action={
            <Link
              href="/activity"
              className="text-content-muted hover:text-content focus-visible:ring-brand/55 inline-flex items-center gap-1 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2"
            >
              {t('viewActivity')}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
        />
        {activityQuery.isLoading ? (
          <Card className="divide-hairline divide-y overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="mt-1.5 h-3 w-24" />
                </div>
              </div>
            ))}
          </Card>
        ) : activityQuery.isError ? (
          <LoadErrorState onRetry={() => void activityQuery.refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState
            className="surface-card"
            icon={<ClockCounterClockwise size={26} />}
            title={ta('noActivity')}
            description={ta('noActivityBody')}
          />
        ) : (
          <Card>
            <ul className="divide-hairline divide-y">
              {recent.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
            </ul>
          </Card>
        )}
      </section>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
