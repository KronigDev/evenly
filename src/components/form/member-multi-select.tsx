'use client';

import { useTranslations } from 'next-intl';
import type { MemberDTO } from '@/lib/api/types';
import { Checkbox } from '@/components/ui/checkbox';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { cn } from '@/lib/utils/cn';

export interface MemberMultiSelectProps {
  members: MemberDTO[];
  value: string[];
  onChange: (memberIds: string[]) => void;
  /** Render the "Everyone" select-all toggle. */
  showSelectAll?: boolean;
  className?: string;
}

/** Reusable checkbox list of group members (avatar + name). */
export function MemberMultiSelect({
  members,
  value,
  onChange,
  showSelectAll = true,
  className,
}: MemberMultiSelectProps) {
  const t = useTranslations('splits');
  const tc = useTranslations('common');

  const selected = new Set(value);
  const allSelected = members.length > 0 && members.every((member) => selected.has(member.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Preserve the original member order in the emitted array.
    onChange(members.filter((member) => next.has(member.id)).map((member) => member.id));
  }

  function toggleAll() {
    onChange(allSelected ? [] : members.map((member) => member.id));
  }

  return (
    <div className={cn('rounded-xl border border-hairline bg-surface', className)}>
      {showSelectAll ? (
        <div className="border-b border-hairline">
          <Checkbox
            checked={allSelected}
            onChange={toggleAll}
            wrapperClassName="flex w-full items-center gap-3 px-3 py-2"
            label={<span className="text-sm font-medium text-content">{t('everyone')}</span>}
          />
        </div>
      ) : null}
      <ul className="divide-y divide-hairline">
        {members.map((member) => {
          const isChecked = selected.has(member.id);
          return (
            <li key={member.id}>
              <Checkbox
                checked={isChecked}
                onChange={() => toggle(member.id)}
                wrapperClassName={cn(
                  'flex w-full items-center gap-3 px-3 py-2 transition-colors',
                  isChecked ? 'bg-brand/[0.04]' : 'hover:bg-surface-2',
                )}
                label={
                  <span className="flex min-w-0 items-center gap-2.5">
                    <MemberAvatar member={member} size="sm" />
                    <span className="truncate text-sm text-content">{member.displayName}</span>
                    {member.isYou ? (
                      <span className="shrink-0 text-2xs font-medium uppercase tracking-eyebrow text-content-subtle">
                        {tc('you')}
                      </span>
                    ) : null}
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
