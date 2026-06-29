'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EnvelopeSimple, X } from '@phosphor-icons/react';
import { Dialog, DialogBody, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api/client';
import type { GroupDTO, PendingInviteDTO } from '@/lib/api/types';
import { ConfirmDialog } from './confirm-dialog';
import { ShareButtons } from './share-buttons';
import { groupKeys } from './queries';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupDTO;
}

export function InviteDialog({ open, onOpenChange, group }: InviteDialogProps) {
  const t = useTranslations('invites');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const canRevoke = group.yourRole === 'ADMIN';

  const invitesQuery = useQuery({
    queryKey: groupKeys.invites(group.id),
    queryFn: ({ signal }) =>
      apiFetch<PendingInviteDTO[]>(`/api/groups/${group.id}/invites`, { signal }),
    enabled: open,
  });

  const createInvite = useMutation({
    mutationFn: (payload: { email: string; displayName?: string }) =>
      apiFetch<{ invite: PendingInviteDTO; shareUrl: string }>(`/api/groups/${group.id}/invites`, {
        method: 'POST',
        body: payload,
      }),
    onSuccess: async (data) => {
      toast.success(t('inviteSent'));
      setShareUrl(data.shareUrl);
      setEmail('');
      setName('');
      await queryClient.invalidateQueries({ queryKey: groupKeys.invites(group.id) });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : te('generic')),
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/groups/${group.id}/invites/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupKeys.invites(group.id) });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError(te('invalidEmail'));
      return;
    }
    setEmailError(null);
    createInvite.mutate({
      email: trimmed,
      displayName: name.trim() ? name.trim() : undefined,
    });
  }

  const invites = invitesQuery.data ?? [];
  const pending = invites.filter((invite) => invite.status === 'PENDING');

  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-label={t('inviteByEmail')}>
      <DialogHeader
        title={t('inviteToGroup', { group: group.name })}
        onClose={() => onOpenChange(false)}
      />
      <DialogBody className="space-y-5">
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <Field label={tc('email')} error={emailError ?? undefined}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label={tc('name')} hint={tc('optional')}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={tc('name')}
            />
          </Field>
          <Button
            type="submit"
            fullWidth
            leftIcon={<EnvelopeSimple size={16} />}
            loading={createInvite.isPending}
          >
            {t('sendInvite')}
          </Button>
        </form>

        {shareUrl ? (
          <section className="space-y-2 rounded-xl border border-hairline bg-surface-2 p-3">
            <p className="eyebrow">{t('shareVia')}</p>
            <ShareButtons url={shareUrl} groupName={group.name} />
          </section>
        ) : null}

        {/* Pending invites */}
        <section className="space-y-2 border-t border-hairline pt-4">
          <p className="eyebrow">{t('pending')}</p>
          {invitesQuery.isLoading ? (
            <Skeleton className="h-10 w-full rounded-lg" />
          ) : pending.length === 0 ? (
            <p className="py-1 text-sm text-content-subtle">{t('noPending')}</p>
          ) : (
            <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
              {pending.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-content">
                    {invite.email}
                  </span>
                  <Badge tone="warning">{t('pending')}</Badge>
                  {canRevoke ? (
                    <IconButton
                      label={t('revoke')}
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
        </section>
      </DialogBody>

      <ConfirmDialog
        open={revokeId !== null}
        onOpenChange={(value) => {
          if (!value) setRevokeId(null);
        }}
        title={t('revoke')}
        description={t('revokeConfirm')}
        confirmLabel={t('revoke')}
        danger
        onConfirm={async () => {
          if (revokeId) await revokeInvite.mutateAsync(revokeId);
          setRevokeId(null);
        }}
      />
    </Dialog>
  );
}
