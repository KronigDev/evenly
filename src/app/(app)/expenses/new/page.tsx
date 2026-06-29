'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, CaretRight } from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import type { GroupSummaryDTO } from '@/lib/api/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

/**
 * Global "Add expense" entry point (used by the app-shell button and the PWA
 * shortcut): pick which group to add the expense to, then continue to that
 * group's expense form.
 */
export default function NewExpensePickerPage() {
  const t = useTranslations();
  const router = useRouter();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiFetch<GroupSummaryDTO[]>('/api/groups'),
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-content">
          {t('expenses.addExpense')}
        </h1>
        <p className="mt-1 text-sm text-content-muted">{t('expenses.expenseDetails')}</p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !groups || groups.length === 0 ? (
        <EmptyState
          icon={<Plus weight="regular" />}
          title={t('dashboard.noGroups')}
          description={t('dashboard.noGroupsBody')}
          action={
            <Button onClick={() => router.push('/groups')}>
              {t('dashboard.createFirstGroup')}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Card
                interactive
                className="flex cursor-pointer items-center gap-3 p-4"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/groups/${group.id}/expenses/new`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/groups/${group.id}/expenses/new`);
                  }
                }}
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-lg"
                >
                  {group.emoji ?? '💸'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-content">{group.name}</span>
                  <span className="block text-xs text-content-muted">
                    {t('groups.memberCount', { count: group.memberCount })}
                  </span>
                </span>
                <CaretRight weight="bold" className="shrink-0 text-content-subtle" />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
