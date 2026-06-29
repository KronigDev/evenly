'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CaretDown, ChartBar, DownloadSimple, Export } from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import type { GroupSummaryDTO, StatsDTO } from '@/lib/api/types';
import { categoryMeta } from '@/lib/categories';
import { PageHeader } from '@/components/app/page-header';
import { LineChart } from '@/components/charts/line-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import { BarChart } from '@/components/charts/bar-chart';
import { Card } from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { Select } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Range = 'month' | '3months' | '6months' | 'year' | 'all';

const RANGES: { value: Range; labelKey: string }[] = [
  { value: 'month', labelKey: 'thisMonth' },
  { value: '3months', labelKey: 'last3Months' },
  { value: '6months', labelKey: 'last6Months' },
  { value: 'year', labelKey: 'thisYear' },
  { value: 'all', labelKey: 'allTime' },
];

/** Concrete chart colours per category accent token (theme-neutral 500-level). */
const CATEGORY_HEX: Record<string, string> = {
  slate: '#64748b',
  green: '#22c55e',
  orange: '#f97316',
  blue: '#3b82f6',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  red: '#ef4444',
  emerald: '#10b981',
  teal: '#14b8a6',
  indigo: '#6366f1',
  yellow: '#eab308',
  zinc: '#71717a',
};

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{children}</p>
    </Card>
  );
}

export default function StatsPage() {
  const t = useTranslations('stats');
  const tc = useTranslations('common');
  const tCat = useTranslations('categories');

  const [groupId, setGroupId] = useState('');
  const [range, setRange] = useState<Range>('6months');

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiFetch<GroupSummaryDTO[]>('/api/groups'),
  });

  useEffect(() => {
    const first = groups?.[0];
    if (!groupId && first) setGroupId(first.id);
  }, [groups, groupId]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', groupId, range],
    queryFn: () => apiFetch<StatsDTO>(`/api/groups/${groupId}/stats?range=${range}`),
    enabled: Boolean(groupId),
  });

  function download(format: 'csv' | 'pdf') {
    if (!groupId) return;
    const anchor = document.createElement('a');
    anchor.href = `/api/groups/${groupId}/export?format=${format}`;
    anchor.download = '';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  const noGroups = !groupsLoading && (!groups || groups.length === 0);
  const isEmpty =
    !!stats && stats.total === 0 && stats.byCategory.length === 0 && stats.byMember.length === 0;
  const loading = groupsLoading || (!!groups && groups.length > 0 && (!groupId || statsLoading));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t('title')}
        action={
          !noGroups ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={!groupId}
                className="border-hairline bg-surface-2 text-content shadow-soft hover:bg-surface-3 focus-visible:ring-brand/55 inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 disabled:opacity-60"
              >
                <Export size={16} aria-hidden="true" />
                <span>{t('export')}</span>
                <CaretDown
                  size={12}
                  weight="bold"
                  aria-hidden="true"
                  className="text-content-subtle"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  icon={<DownloadSimple size={16} />}
                  onSelect={() => download('csv')}
                >
                  {t('exportCsv')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<DownloadSimple size={16} />}
                  onSelect={() => download('pdf')}
                >
                  {t('exportPdf')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      {noGroups ? (
        <div className="mt-6">
          <EmptyState
            icon={<ChartBar weight="regular" />}
            title={t('noData')}
            description={tc('none')}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3">
            <Select
              aria-label={tc('group')}
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              className="w-full sm:max-w-xs"
            >
              {groups?.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>

            <SegmentedControl<Range>
              size="sm"
              className="hidden w-full lg:flex"
              aria-label={t('dateRange')}
              value={range}
              onChange={setRange}
              options={RANGES.map((entry) => ({ value: entry.value, label: t(entry.labelKey) }))}
            />
            <Select
              aria-label={t('dateRange')}
              value={range}
              onChange={(event) => setRange(event.target.value as Range)}
              className="w-full sm:max-w-xs lg:hidden"
            >
              {RANGES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {t(entry.labelKey)}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
                <Skeleton className="h-56 w-full rounded-xl" />
                <Skeleton className="h-56 w-full rounded-xl" />
              </div>
            ) : !stats || isEmpty ? (
              <EmptyState
                icon={<ChartBar weight="regular" />}
                title={t('noData')}
                description={t('noDataBody')}
              />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StatCard label={t('totalSpent')}>
                    <Money cents={stats.total} currency={stats.currency} />
                  </StatCard>
                  <StatCard label={t('yourShare')}>
                    <Money cents={stats.yourShare} currency={stats.currency} />
                  </StatCard>
                </div>

                {stats.overTime.length > 0 ? (
                  <Card className="p-5">
                    <h2 className="text-content text-sm font-semibold">{t('spendingOverTime')}</h2>
                    <div className="mt-4">
                      <LineChart
                        data={stats.overTime.map((point) => ({
                          label: point.label,
                          value: point.total,
                        }))}
                        currency={stats.currency}
                        aria-label={t('spendingOverTime')}
                      />
                    </div>
                  </Card>
                ) : null}

                {stats.byCategory.length > 0 ? (
                  <Card className="p-5">
                    <h2 className="text-content text-sm font-semibold">{t('byCategory')}</h2>
                    <div className="mt-4">
                      <DonutChart
                        currency={stats.currency}
                        centerLabel={t('totalSpent')}
                        aria-label={t('byCategory')}
                        data={stats.byCategory.map((entry) => ({
                          label: tCat(entry.category),
                          value: entry.total,
                          color: CATEGORY_HEX[categoryMeta(entry.category).color],
                        }))}
                      />
                    </div>
                  </Card>
                ) : null}

                {stats.byMember.length > 0 ? (
                  <Card className="p-5">
                    <h2 className="text-content text-sm font-semibold">{t('byPerson')}</h2>
                    <div className="mt-4">
                      <BarChart
                        currency={stats.currency}
                        aria-label={t('byPerson')}
                        data={stats.byMember.map((entry) => ({
                          label: entry.name,
                          value: entry.total,
                        }))}
                      />
                    </div>
                  </Card>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
