'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export interface AcceptInviteButtonProps {
  token: string;
  groupName: string;
}

/** Joins the inviting group for a signed-in user, then routes to the group. */
export function AcceptInviteButton({ token, groupName }: AcceptInviteButtonProps) {
  const t = useTranslations('invites');
  const te = useTranslations('errors');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    try {
      const { groupId } = await apiFetch<{ groupId: string }>('/api/invites/accept', {
        method: 'POST',
        body: { token },
      });
      toast.success(t('inviteAccepted', { group: groupName }));
      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (error) {
      setLoading(false);
      if (error instanceof ApiClientError) {
        toast.error(error.message || te('generic'));
      } else {
        toast.error(te('network'));
      }
    }
  }

  return (
    <Button size="lg" fullWidth loading={loading} onClick={() => void accept()}>
      {t('joinGroup')}
    </Button>
  );
}
