'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MagnifyingGlass, Plus, Receipt } from '@phosphor-icons/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api/client';
import { CATEGORY_KEYS } from '@/lib/categories';
import type { ExpenseDTO, GroupDTO } from '@/lib/api/types';
import { ExpenseRow } from './expense-row';
import { ExpenseDetailSheet } from './expense-detail-sheet';
import { buildExpensesUrl, groupKeys, type ExpenseFilters, type ExpensesPage } from './queries';

export interface ExpenseListProps {
  group: GroupDTO;
}

export function ExpenseList({ group }: ExpenseListProps) {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const tCat = useTranslations('categories');
  const tg = useTranslations('groups');

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ExpenseFilters>({
    q: '',
    category: '',
    memberId: '',
    from: '',
    to: '',
  });

  const [selected, setSelected] = useState<ExpenseDTO | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Debounce the free-text search into the query filters.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilters((prev) => (prev.q === search ? prev : { ...prev, q: search }));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  const query = useInfiniteQuery({
    queryKey: groupKeys.expenses(group.id, filters),
    queryFn: ({ pageParam, signal }) =>
      apiFetch<ExpensesPage>(buildExpensesUrl(group.id, filters, pageParam), { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const expenses = useMemo(
    () => query.data?.pages.flatMap((page) => page.expenses) ?? [],
    [query.data],
  );

  const activeMembers = group.members.filter((member) => member.status !== 'LEFT');
  const hasActiveFilters =
    filters.q !== '' ||
    filters.category !== '' ||
    filters.memberId !== '' ||
    filters.from !== '' ||
    filters.to !== '';

  function resetFilters() {
    setSearch('');
    setFilters({ q: '', category: '', memberId: '', from: '', to: '' });
  }

  function openExpense(expense: ExpenseDTO) {
    setSelected(expense);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="p-3">
        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <MagnifyingGlass
              size={16}
              aria-hidden="true"
              className="text-content-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tc('search')}
              aria-label={tc('search')}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select
              value={filters.category}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, category: event.target.value }))
              }
              aria-label={tc('category')}
            >
              <option value="">{tc('all')}</option>
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {tCat(key)}
                </option>
              ))}
            </Select>
            <Select
              value={filters.memberId}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, memberId: event.target.value }))
              }
              aria-label={tc('members')}
            >
              <option value="">{tc('all')}</option>
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              aria-label={t('date')}
              max={filters.to || undefined}
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              aria-label={t('date')}
              min={filters.from || undefined}
            />
          </div>
          {hasActiveFilters ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                {tc('clear')}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      {/* List */}
      <Card className="overflow-hidden">
        {query.isLoading ? (
          <ul className="divide-hairline divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <li key={index} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-3.5 w-16" />
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <EmptyState
            icon={<Receipt size={26} />}
            title={tc('somethingWentWrong')}
            action={
              <Button variant="secondary" onClick={() => query.refetch()}>
                {tc('retry')}
              </Button>
            }
          />
        ) : expenses.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={<MagnifyingGlass size={26} />}
              title={t('noExpenses')}
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  {tc('clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Receipt size={26} />}
              title={tg('noExpenses')}
              description={tg('noExpensesBody')}
              action={
                <Button asChild leftIcon={<Plus size={16} />}>
                  <Link href={`/groups/${group.id}/expenses/new`}>{tg('addFirstExpense')}</Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className="divide-hairline divide-y">
              {expenses.map((expense) => (
                <li key={expense.id}>
                  <ExpenseRow
                    expense={expense}
                    currentMemberId={group.yourMemberId}
                    baseCurrency={group.baseCurrency}
                    onSelect={openExpense}
                  />
                </li>
              ))}
            </ul>
            {query.hasNextPage ? (
              <div className="border-hairline border-t p-3">
                <Button
                  variant="ghost"
                  fullWidth
                  loading={query.isFetchingNextPage}
                  onClick={() => query.fetchNextPage()}
                >
                  {tc('showMore')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <ExpenseDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        groupId={group.id}
        expense={selected}
        members={group.members}
        baseCurrency={group.baseCurrency}
      />
    </div>
  );
}
