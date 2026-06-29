'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArrowUUpLeft,
  ClockCounterClockwise,
  DotsThree,
  DownloadSimple,
  EnvelopeSimple,
  FilePdf,
  PencilSimple,
  Plus,
  Receipt,
  Scales,
  SignOut,
  TrashSimple,
  Users,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Money } from '@/components/ui/money';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import type { BalancesDTO, GroupDTO } from '@/lib/api/types';
import { ExpenseList } from '@/components/group/expense-list';
import { BalancesView } from '@/components/group/balances-view';
import { MembersPanel } from '@/components/group/members-panel';
import { ActivityTab } from '@/components/group/activity-tab';
import { SettleDialog } from '@/components/group/settle-dialog';
import { EditGroupDialog } from '@/components/group/edit-group-dialog';
import { InviteDialog } from '@/components/group/invite-dialog';
import { ConfirmDialog } from '@/components/group/confirm-dialog';
import {
  groupKeys,
  groupTileClass,
  triggerDownload,
  useInvalidateGroup,
} from '@/components/group/queries';

type TabValue = 'expenses' | 'balances' | 'members' | 'activity';

export default function GroupDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const rawId = params?.id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? (rawId[0] ?? '') : '';

  const t = useTranslations('groups');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const tb = useTranslations('balances');
  const ts = useTranslations('settle');
  const tExp = useTranslations('expenses');
  const tStats = useTranslations('stats');
  const tActivity = useTranslations('activity');
  const router = useRouter();
  const { toast } = useToast();
  const invalidateGroup = useInvalidateGroup(id);

  const [tab, setTab] = useState<TabValue>('expenses');
  const [settleOpen, setSettleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const groupQuery = useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: ({ signal }) => apiFetch<GroupDTO>(`/api/groups/${id}`, { signal }),
    enabled: id !== '',
  });

  const balancesQuery = useQuery({
    queryKey: groupKeys.balances(id),
    queryFn: ({ signal }) => apiFetch<BalancesDTO>(`/api/groups/${id}/balances`, { signal }),
    enabled: id !== '',
  });

  const group = groupQuery.data;

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) =>
      apiFetch(`/api/groups/${id}`, { method: 'PATCH', body: { archived } }),
    onSuccess: async () => {
      await invalidateGroup();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : te('generic')),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiFetch(`/api/groups/${id}/leave`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('leaveGroup'));
      router.push('/dashboard');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteGroup'));
      router.push('/dashboard');
    },
  });

  // ---- Loading & error states -------------------------------------------------
  if (groupQuery.isLoading || id === '') {
    return <GroupSkeleton />;
  }

  if (groupQuery.isError || !group) {
    const status = groupQuery.error instanceof ApiClientError ? groupQuery.error.status : 0;
    const title =
      status === 404 ? te('notFound') : status === 403 ? te('forbidden') : tc('somethingWentWrong');
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <EmptyState
          icon={<Receipt size={26} />}
          title={title}
          action={
            <Button asChild variant="secondary">
              <Link href="/dashboard">{te('goHome')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const isAdmin = group.yourRole === 'ADMIN';
  const activeMembers = group.members.filter((member) => member.status !== 'LEFT');
  const extraMembers = Math.max(0, activeMembers.length - 5);
  const balances = balancesQuery.data;
  const yourNet = group.yourMemberId
    ? (balances?.net.find((entry) => entry.memberId === group.yourMemberId)?.net ?? 0)
    : 0;
  const yourNetLabel =
    yourNet > 0
      ? tb('positiveBalance')
      : yourNet < 0
        ? tb('negativeBalance')
        : t('youreAllSettled');

  const tabItems: TabItem<TabValue>[] = [
    { value: 'expenses', label: t('expenses'), icon: <Receipt size={16} /> },
    { value: 'balances', label: t('balances'), icon: <Scales size={16} /> },
    { value: 'members', label: tc('members'), icon: <Users size={16} /> },
    { value: 'activity', label: tActivity('title'), icon: <ClockCounterClockwise size={16} /> },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-24 sm:pb-12">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl',
              groupTileClass(group.color),
            )}
            aria-hidden="true"
          >
            {group.emoji ?? group.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-content truncate text-xl font-semibold">{group.name}</h1>
              {group.archived ? <Badge tone="neutral">{t('archived')}</Badge> : null}
            </div>
            {group.description ? (
              <p className="text-content-muted mt-0.5 text-sm text-pretty">{group.description}</p>
            ) : null}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex -space-x-2">
                {activeMembers.slice(0, 5).map((member) => (
                  <MemberAvatar
                    key={member.id}
                    member={member}
                    size="sm"
                    className="ring-canvas rounded-full ring-2"
                  />
                ))}
              </div>
              {extraMembers > 0 ? (
                <span className="text-content-muted text-xs">+{extraMembers}</span>
              ) : null}
              <span className="text-content-subtle text-xs">
                · {t('memberCount', { count: activeMembers.length })}
              </span>
            </div>
          </div>

          {/* Group menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('menu')}
              className="text-content-muted hover:bg-surface-2 focus-visible:ring-brand/55 grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors outline-none focus-visible:ring-2"
            >
              <DotsThree size={22} weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                icon={<PencilSimple size={16} />}
                onSelect={() => setEditOpen(true)}
              >
                {t('editGroup')}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<EnvelopeSimple size={16} />}
                onSelect={() => setInviteOpen(true)}
              >
                {t('addMembers')}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<DownloadSimple size={16} />}
                onSelect={() => triggerDownload(`/api/groups/${id}/export?format=csv`)}
              >
                {tStats('exportCsv')}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<FilePdf size={16} />}
                onSelect={() => triggerDownload(`/api/groups/${id}/export?format=pdf`)}
              >
                {tStats('exportPdf')}
              </DropdownMenuItem>
              {isAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    icon={group.archived ? <ArrowUUpLeft size={16} /> : <Archive size={16} />}
                    onSelect={() => archiveMutation.mutate(!group.archived)}
                  >
                    {group.archived ? t('unarchive') : t('archive')}
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<SignOut size={16} />} onSelect={() => setLeaveOpen(true)}>
                {t('leaveGroup')}
              </DropdownMenuItem>
              {isAdmin ? (
                <DropdownMenuItem
                  danger
                  icon={<TrashSimple size={16} />}
                  onSelect={() => setDeleteOpen(true)}
                >
                  {t('deleteGroup')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Your balance + primary actions */}
        <div className="border-hairline bg-surface shadow-soft flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">{t('yourSummary')}</p>
            <div className="mt-1 flex items-baseline gap-2">
              {balancesQuery.isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <Money
                  cents={yourNet}
                  currency={group.baseCurrency}
                  colored
                  signed
                  className="text-lg"
                />
              )}
              <span className="text-content-muted text-sm">{yourNetLabel}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => setSettleOpen(true)}>
              {ts('settleUp')}
            </Button>
            <Button asChild leftIcon={<Plus size={16} />}>
              <Link href={`/groups/${id}/expenses/new`}>{tExp('addExpense')}</Link>
            </Button>
          </div>
        </div>

        {/* Archived banner */}
        {group.archived ? (
          <div className="border-warning/30 bg-warning/10 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <p className="text-content text-sm">{t('archived')}</p>
            {isAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowUUpLeft size={14} />}
                loading={archiveMutation.isPending}
                onClick={() => archiveMutation.mutate(false)}
              >
                {t('unarchive')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* Tabs */}
      <div className="bg-canvas/90 supports-[backdrop-filter]:bg-canvas/70 sticky top-0 z-10 -mx-4 mt-4 px-4 backdrop-blur">
        <Tabs value={tab} onValueChange={setTab} items={tabItems} aria-label={t('title')} />
      </div>

      {/* Panels */}
      <div className="mt-4">
        {tab === 'expenses' ? <ExpenseList group={group} /> : null}
        {tab === 'balances' ? (
          balances ? (
            <BalancesView group={group} balances={balances} />
          ) : (
            <PanelSkeleton />
          )
        ) : null}
        {tab === 'members' ? (
          balances ? (
            <MembersPanel group={group} balances={balances} />
          ) : (
            <PanelSkeleton />
          )
        ) : null}
        {tab === 'activity' ? <ActivityTab groupId={id} /> : null}
      </div>

      {/* Dialogs */}
      <SettleDialog open={settleOpen} onOpenChange={setSettleOpen} group={group} />
      <EditGroupDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        group={group}
        onSaved={invalidateGroup}
      />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} group={group} />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={t('leaveGroup')}
        description={t('leaveGroupConfirm')}
        confirmLabel={t('leaveGroup')}
        danger
        onConfirm={async () => {
          await leaveMutation.mutateAsync();
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteGroup')}
        description={t('deleteGroupConfirm')}
        confirmLabel={t('deleteGroup')}
        danger
        onConfirm={async () => {
          await deleteMutation.mutateAsync();
        }}
      />
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-10 w-full" />
      <PanelSkeleton />
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
