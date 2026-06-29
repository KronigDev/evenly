'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CaretRight, Plus, UsersThree, WarningCircle } from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import type { GroupSummaryDTO } from '@/lib/api/types';
import { PageHeader } from '@/components/app/page-header';
import { AddFriendDialog } from '@/components/friends/add-friend-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

function FriendRow({ friend }: { friend: GroupSummaryDTO }) {
  const t = useTranslations('dashboard');
  const tf = useTranslations('friends');
  const name = friend.counterpartName ?? friend.name;
  const settled = friend.yourNet === 0;
  const caption = settled
    ? tf('settledWithFriend', { name })
    : friend.yourNet > 0
      ? t('youAreOwed')
      : t('youOwe');

  return (
    <Link
      href={`/groups/${friend.id}`}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand/55 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <Card interactive className="flex items-center gap-4 p-4">
        <Avatar name={name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-content">{name}</p>
          <p className="truncate text-xs text-content-muted">{caption}</p>
        </div>
        {settled ? (
          <span aria-hidden="true" className="text-sm font-medium text-content-subtle">
            —
          </span>
        ) : (
          <Money
            cents={friend.yourNet}
            currency={friend.baseCurrency}
            colored
            signed
            className="text-base font-semibold"
          />
        )}
        <CaretRight size={16} aria-hidden="true" className="shrink-0 text-content-subtle" />
      </Card>
    </Link>
  );
}

export default function FriendsPage() {
  const t = useTranslations('friends');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const friendsQuery = useQuery({
    queryKey: ['friends'],
    queryFn: ({ signal }) => apiFetch<GroupSummaryDTO[]>('/api/friends', { signal }),
  });

  useEffect(() => {
    if (friendsQuery.isError) toast.error(te('generic'));
  }, [friendsQuery.isError, toast, te]);

  const friends = friendsQuery.data ?? [];

  return (
    <div className="animate-fade-up space-y-8">
      <PageHeader
        title={t('title')}
        action={
          <Button leftIcon={<Plus size={18} weight="bold" />} onClick={() => setAddOpen(true)}>
            {t('addFriend')}
          </Button>
        }
      />

      {friendsQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1.5 h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-16" />
            </Card>
          ))}
        </div>
      ) : friendsQuery.isError ? (
        <EmptyState
          className="surface-card"
          icon={<WarningCircle size={26} />}
          title={tc('somethingWentWrong')}
          action={
            <Button variant="secondary" onClick={() => void friendsQuery.refetch()}>
              {tc('retry')}
            </Button>
          }
        />
      ) : friends.length === 0 ? (
        <EmptyState
          className="surface-card"
          icon={<UsersThree size={26} />}
          title={t('noFriends')}
          description={t('noFriendsBody')}
          action={
            <Button leftIcon={<Plus size={18} weight="bold" />} onClick={() => setAddOpen(true)}>
              {t('addFriend')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {friends.map((friend) => (
            <FriendRow key={friend.id} friend={friend} />
          ))}
        </div>
      )}

      <AddFriendDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
