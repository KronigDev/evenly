'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellSimple, DotsThree, EnvelopeSimple, UserPlus, X } from '@phosphor-icons/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Money } from '@/components/ui/money';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api/client';
import type { BalancesDTO, GroupDTO, MemberDTO, PendingInviteDTO } from '@/lib/api/types';
import { ConfirmDialog } from './confirm-dialog';
import { InviteDialog } from './invite-dialog';
import { buildNetMap, groupKeys, useInvalidateGroup } from './queries';

export interface MembersPanelProps {
  group: GroupDTO;
  balances: BalancesDTO;
}

export function MembersPanel({ group, balances }: MembersPanelProps) {
  const t = useTranslations('members');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const ts = useTranslations('settle');
  const ti = useTranslations('invites');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidateGroup = useInvalidateGroup(group.id);

  const isAdmin = group.yourRole === 'ADMIN';
  const netMap = useMemo(() => buildNetMap(balances.net), [balances.net]);

  // Members who owe the current member (from the pairwise breakdown).
  const owesYou = useMemo(() => {
    const set = new Set<string>();
    if (group.yourMemberId) {
      for (const transfer of balances.pairwise) {
        if (transfer.toMemberId === group.yourMemberId) set.add(transfer.fromMemberId);
      }
    }
    return set;
  }, [balances.pairwise, group.yourMemberId]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [removeTarget, setRemoveTarget] = useState<MemberDTO | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const invitesQuery = useQuery({
    queryKey: groupKeys.invites(group.id),
    queryFn: ({ signal }) =>
      apiFetch<PendingInviteDTO[]>(`/api/groups/${group.id}/invites`, { signal }),
  });

  const patchRole = useMutation({
    mutationFn: (vars: { memberId: string; role: 'ADMIN' | 'MEMBER' }) =>
      apiFetch(`/api/groups/${group.id}/members/${vars.memberId}`, {
        method: 'PATCH',
        body: { role: vars.role },
      }),
    onSuccess: () => invalidateGroup(),
    onError: (error) => toast.error(error instanceof Error ? error.message : te('generic')),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(`/api/groups/${group.id}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('removeMember'));
      await invalidateGroup();
    },
  });

  const addPerson = useMutation({
    mutationFn: (name: string) =>
      apiFetch<MemberDTO>(`/api/groups/${group.id}/members`, { method: 'POST', body: { name } }),
    onSuccess: async () => {
      toast.success(tc('add'));
      setAddOpen(false);
      setAddName('');
      await invalidateGroup();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : te('generic')),
  });

  const remind = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(`/api/groups/${group.id}/remind`, { method: 'POST', body: { memberId } }),
    onSuccess: () => toast.success(ts('reminderSent')),
    onError: (error) => toast.error(error instanceof Error ? error.message : te('generic')),
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/groups/${group.id}/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.invites(group.id) }),
  });

  function onAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = addName.trim();
    if (!name || addPerson.isPending) return;
    addPerson.mutate(name);
  }

  const visibleMembers = group.members.filter((member) => member.status !== 'LEFT');
  const pendingInvites = (invitesQuery.data ?? []).filter((invite) => invite.status === 'PENDING');

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          leftIcon={<UserPlus size={16} />}
          onClick={() => setAddOpen(true)}
        >
          {t('addByName')}
        </Button>
        <Button
          variant="secondary"
          leftIcon={<EnvelopeSimple size={16} />}
          onClick={() => setInviteOpen(true)}
        >
          {t('invite')}
        </Button>
      </div>

      {/* Members */}
      <Card className="overflow-hidden">
        <ul className="divide-hairline divide-y">
          {visibleMembers.map((member) => {
            const net = netMap.get(member.id) ?? 0;
            const canRemind = !member.isYou && owesYou.has(member.id);
            return (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <MemberAvatar member={member} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-content truncate text-sm font-medium">
                      {member.displayName}
                    </span>
                    {member.isYou ? (
                      <span className="text-content-subtle text-xs">{tc('you')}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={member.role === 'ADMIN' ? 'brand' : 'neutral'}>
                      {member.role === 'ADMIN' ? t('admin') : t('member')}
                    </Badge>
                    {member.status === 'INVITED' ? (
                      <Badge tone="warning">{t('invited')}</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {net !== 0 ? (
                    <Money
                      cents={net}
                      currency={balances.currency}
                      colored
                      signed
                      className="text-sm font-medium"
                    />
                  ) : (
                    <span className="text-content-subtle text-xs">{tc('done')}</span>
                  )}

                  {canRemind ? (
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<BellSimple size={14} />}
                      loading={remind.isPending && remind.variables === member.id}
                      onClick={() => remind.mutate(member.id)}
                    >
                      {ts('remind')}
                    </Button>
                  ) : null}

                  {isAdmin ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={tc('actions')}
                        className="text-content-muted hover:bg-surface-2 focus-visible:ring-brand/55 grid h-8 w-8 place-items-center rounded-md transition-colors outline-none focus-visible:ring-2"
                      >
                        <DotsThree size={20} weight="bold" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {member.role === 'MEMBER' ? (
                          <DropdownMenuItem
                            onSelect={() =>
                              patchRole.mutate({ memberId: member.id, role: 'ADMIN' })
                            }
                          >
                            {t('makeAdmin')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() =>
                              patchRole.mutate({ memberId: member.id, role: 'MEMBER' })
                            }
                          >
                            {t('removeAdmin')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          danger
                          disabled={member.isYou}
                          onSelect={() => setRemoveTarget(member)}
                        >
                          {t('removeMember')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Pending invites */}
      <Card className="overflow-hidden">
        <div className="border-hairline border-b px-4 py-2.5">
          <p className="eyebrow">{ti('pending')}</p>
        </div>
        {invitesQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ) : pendingInvites.length === 0 ? (
          <p className="text-content-subtle px-4 py-3 text-sm">{ti('noPending')}</p>
        ) : (
          <ul className="divide-hairline divide-y">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-content min-w-0 flex-1 truncate text-sm">{invite.email}</span>
                <Badge tone="warning">{ti('pending')}</Badge>
                {isAdmin ? (
                  <IconButton
                    label={ti('revoke')}
                    size="sm"
                    variant="ghost"
                    className="text-content-subtle hover:text-negative"
                    onClick={() => setRevokeId(invite.id)}
                  >
                    <X size={16} />
                  </IconButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} group={group} />

      {/* Add placeholder person */}
      <Dialog open={addOpen} onOpenChange={setAddOpen} aria-label={t('addByName')}>
        <DialogHeader title={t('addByName')} onClose={() => setAddOpen(false)} />
        <form onSubmit={onAddSubmit}>
          <DialogBody>
            <Field label={t('memberName')} hint={t('addByNameHint')}>
              <Input
                value={addName}
                onChange={(event) => setAddName(event.target.value)}
                placeholder={t('namePlaceholder')}
                autoFocus
                maxLength={60}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              loading={addPerson.isPending}
              disabled={addName.trim().length === 0}
            >
              {tc('add')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(value) => {
          if (!value) setRemoveTarget(null);
        }}
        title={t('removeMember')}
        description={
          removeTarget ? t('removeMemberConfirm', { name: removeTarget.displayName }) : ''
        }
        confirmLabel={tc('remove')}
        danger
        onConfirm={async () => {
          if (removeTarget) await removeMember.mutateAsync(removeTarget.id);
          setRemoveTarget(null);
        }}
      />

      <ConfirmDialog
        open={revokeId !== null}
        onOpenChange={(value) => {
          if (!value) setRevokeId(null);
        }}
        title={ti('revoke')}
        description={ti('revokeConfirm')}
        confirmLabel={ti('revoke')}
        danger
        onConfirm={async () => {
          if (revokeId) await revokeInvite.mutateAsync(revokeId);
          setRevokeId(null);
        }}
      />
    </div>
  );
}
