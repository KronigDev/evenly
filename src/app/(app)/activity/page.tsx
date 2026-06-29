'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api/client';
import type { GroupSummaryDTO } from '@/lib/api/types';
import { PageHeader } from '@/components/app/page-header';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { Select } from '@/components/ui/select';

export default function ActivityPage() {
  const t = useTranslations('activity');
  const tc = useTranslations('common');
  const [groupId, setGroupId] = useState('');

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiFetch<GroupSummaryDTO[]>('/api/groups'),
  });

  const hasGroups = Boolean(groups && groups.length > 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t('title')}
        action={
          hasGroups ? (
            <Select
              aria-label={tc('group')}
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              className="w-44"
            >
              <option value="">{tc('all')}</option>
              {groups?.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />

      <div className="mt-6">
        <ActivityFeed groupId={groupId || undefined} />
      </div>
    </div>
  );
}
