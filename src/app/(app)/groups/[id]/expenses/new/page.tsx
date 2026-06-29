'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import type { GroupDTO } from '@/lib/api/types';
import { ExpenseForm } from '@/components/expense/expense-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function readParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? '';
  return '';
}

export default function NewExpensePage() {
  const params = useParams();
  const groupId = readParam(params.id);
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const te = useTranslations('errors');

  const {
    data: group,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => apiFetch<GroupDTO>(`/api/groups/${groupId}`),
    enabled: groupId.length > 0,
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-5">
        <Button asChild variant="ghost" size="sm" className="text-content-muted mb-3 -ml-2">
          <Link href={`/groups/${groupId}`}>
            <ArrowLeft size={16} aria-hidden="true" />
            {tc('back')}
          </Link>
        </Button>
        <h1 className="text-content text-xl font-semibold">{t('addExpense')}</h1>
      </div>

      {isLoading ? (
        <FormSkeleton />
      ) : isError || !group ? (
        <p
          role="alert"
          className="border-negative/30 bg-negative/10 text-negative rounded-lg border px-4 py-3 text-sm"
        >
          {te('generic')}
        </p>
      ) : (
        <ExpenseForm group={group} members={group.members} mode="create" />
      )}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-11 w-40" />
    </div>
  );
}
