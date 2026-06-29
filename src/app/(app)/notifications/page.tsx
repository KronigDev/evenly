'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { formatDistanceToNowStrict } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import {
  ArrowsLeftRight,
  Bell,
  BellRinging,
  ChatCircle,
  EnvelopeSimple,
  Receipt,
  UserPlus,
  type Icon,
} from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import type { NotificationDTO } from '@/lib/api/types';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

interface NotificationsData {
  notifications: NotificationDTO[];
  unreadCount: number;
}

interface ReadPayload {
  all?: true;
  ids?: string[];
}

const QUERY_KEY = ['notifications'] as const;

function pickString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return undefined;
}

interface MessageSpec {
  key: string;
  icon: Icon;
  needs?: ('group' | 'actor' | 'name' | 'description')[];
}

const NOTIFICATION_MESSAGES: Record<string, MessageSpec> = {
  EXPENSE_ADDED: { key: 'newExpense', icon: Receipt, needs: ['group'] },
  EXPENSE_CREATED: { key: 'newExpense', icon: Receipt, needs: ['group'] },
  SETTLEMENT_ADDED: { key: 'newSettlement', icon: ArrowsLeftRight, needs: ['actor'] },
  SETTLEMENT_CREATED: { key: 'newSettlement', icon: ArrowsLeftRight, needs: ['actor'] },
  PAYMENT_RECORDED: { key: 'newSettlement', icon: ArrowsLeftRight, needs: ['actor'] },
  COMMENT_ADDED: { key: 'newComment', icon: ChatCircle, needs: ['actor', 'description'] },
  MEMBER_JOINED: { key: 'memberJoined', icon: UserPlus, needs: ['name', 'group'] },
  INVITE_RECEIVED: { key: 'inviteReceived', icon: EnvelopeSimple, needs: ['name', 'group'] },
  MEMBER_INVITED: { key: 'inviteReceived', icon: EnvelopeSimple, needs: ['name', 'group'] },
  INVITE_SENT: { key: 'inviteReceived', icon: EnvelopeSimple, needs: ['name', 'group'] },
  REMINDER_RECEIVED: { key: 'reminderReceived', icon: BellRinging, needs: ['actor'] },
  REMINDER_SENT: { key: 'reminderReceived', icon: BellRinging, needs: ['actor'] },
};

function targetHref(data: Record<string, unknown>): string | null {
  const groupId = pickString(data, ['groupId']);
  const expenseId = pickString(data, ['expenseId']);
  if (!groupId) return null;
  return expenseId
    ? `/groups/${groupId}?expense=${encodeURIComponent(expenseId)}`
    : `/groups/${groupId}`;
}

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeLocale = useLocale();
  const dateLocale = activeLocale === 'de' ? de : enUS;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<NotificationsData>('/api/notifications'),
  });

  const markRead = useMutation({
    mutationFn: (payload: ReadPayload) =>
      apiFetch('/api/notifications/read', { method: 'POST', body: payload }),
    onMutate: async (payload: ReadPayload) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationsData>(QUERY_KEY);
      queryClient.setQueryData<NotificationsData>(QUERY_KEY, (old) => {
        if (!old) return old;
        const ids = payload.all ? null : new Set(payload.ids ?? []);
        const notifications = old.notifications.map((notification) =>
          payload.all || ids?.has(notification.id) ? { ...notification, read: true } : notification,
        );
        return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
      });
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  function handleOpen(notification: NotificationDTO) {
    if (!notification.read) markRead.mutate({ ids: [notification.id] });
    const href = targetHref(notification.data);
    if (href) router.push(href);
  }

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t('title')}
        action={
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? <Badge tone="brand">{unreadCount}</Badge> : null}
            <Button
              variant="secondary"
              size="sm"
              disabled={unreadCount === 0 || markRead.isPending}
              onClick={() => markRead.mutate({ all: true })}
            >
              {t('markAllRead')}
            </Button>
          </div>
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <div className="surface-card divide-y divide-hairline">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/5" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Bell weight="regular" />}
            title={tc('somethingWentWrong')}
            action={
              <Button variant="secondary" onClick={() => void refetch()}>
                {tc('retry')}
              </Button>
            }
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell weight="regular" />}
            title={t('noNotifications')}
            description={t('noNotificationsBody')}
          />
        ) : (
          <ul className="surface-card divide-y divide-hairline">
            {notifications.map((notification) => {
              const spec = NOTIFICATION_MESSAGES[notification.type];
              const IconComponent = spec?.icon ?? Bell;

              let text: string;
              if (spec) {
                const values: Record<string, string> = {};
                if (spec.needs?.includes('group'))
                  values.group =
                    pickString(notification.data, ['groupName', 'group']) ?? tc('group');
                if (spec.needs?.includes('actor'))
                  values.actor =
                    pickString(notification.data, ['actorName', 'actor', 'name']) ?? tc('members');
                if (spec.needs?.includes('name'))
                  values.name =
                    pickString(notification.data, ['name', 'memberName', 'actorName', 'email']) ??
                    tc('members');
                if (spec.needs?.includes('description'))
                  values.description =
                    pickString(notification.data, ['description', 'expenseDescription']) ??
                    tc('expense');
                text = t(spec.key, values);
              } else {
                text = t('title');
              }

              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleOpen(notification)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-4 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 sm:px-5',
                      !notification.read && 'bg-brand/[0.04]',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                        notification.read
                          ? 'bg-surface-2 text-content-muted'
                          : 'bg-brand/12 text-brand',
                      )}
                    >
                      <IconComponent size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-pretty text-sm',
                          notification.read ? 'text-content-muted' : 'font-medium text-content',
                        )}
                      >
                        {text}
                      </p>
                      <time
                        dateTime={notification.createdAt}
                        className="mt-0.5 block text-2xs text-content-subtle"
                      >
                        {formatDistanceToNowStrict(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </time>
                    </div>
                    {!notification.read ? (
                      <span
                        aria-label={t('unread')}
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
