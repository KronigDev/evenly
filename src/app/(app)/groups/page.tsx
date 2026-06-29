'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CaretDown, Plus, UsersThree, WarningCircle } from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import type { GroupSummaryDTO } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';
import { GroupCard } from '@/components/app/group-card';
import { PageHeader } from '@/components/app/page-header';
import { CreateGroupDialog } from '@/components/groups/create-group-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

export default function GroupsPage() {
  const t = useTranslations('groups');
  const td = useTranslations('dashboard');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: ({ signal }) => apiFetch<GroupSummaryDTO[]>('/api/groups', { signal }),
  });

  useEffect(() => {
    if (groupsQuery.isError) toast.error(te('generic'));
  }, [groupsQuery.isError, toast, te]);

  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const active = useMemo(() => groups.filter((g) => !g.archived), [groups]);
  const archived = useMemo(() => groups.filter((g) => g.archived), [groups]);

  return (
    <div className="animate-fade-up space-y-8">
      <PageHeader
        title={t('title')}
        action={
          <Button leftIcon={<Plus size={18} weight="bold" />} onClick={() => setCreateOpen(true)}>
            {t('newGroup')}
          </Button>
        }
      />

      {groupsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="h-32 p-4">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="mt-3 h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </Card>
          ))}
        </div>
      ) : groupsQuery.isError ? (
        <EmptyState
          className="surface-card"
          icon={<WarningCircle size={26} />}
          title={tc('somethingWentWrong')}
          action={
            <Button variant="secondary" onClick={() => void groupsQuery.refetch()}>
              {tc('retry')}
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          className="surface-card"
          icon={<UsersThree size={26} />}
          title={td('noGroups')}
          description={td('noGroupsBody')}
          action={
            <Button leftIcon={<Plus size={18} weight="bold" />} onClick={() => setCreateOpen(true)}>
              {td('createFirstGroup')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {active.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : null}

          {archived.length > 0 ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowArchived((value) => !value)}
                aria-expanded={showArchived}
                className="text-content-muted hover:text-content focus-visible:ring-brand/55 flex items-center gap-2 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2"
              >
                <CaretDown
                  size={16}
                  weight="bold"
                  aria-hidden="true"
                  className={cn('transition-transform duration-200', showArchived && 'rotate-180')}
                />
                {t('archivedGroups')}
                <span className="text-content-subtle">({archived.length})</span>
              </button>
              {showArchived ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {archived.map((group) => (
                    <GroupCard key={group.id} group={group} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
