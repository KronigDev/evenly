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
    <div className={cn('border-hairline bg-surface rounded-xl border', className)}>
      {showSelectAll ? (
        <div className="border-hairline border-b">
          <Checkbox
            checked={allSelected}
            onChange={toggleAll}
            wrapperClassName="flex w-full items-center gap-3 px-3 py-2"
            label={<span className="text-content text-sm font-medium">{t('everyone')}</span>}
          />
        </div>
      ) : null}
      <ul className="divide-hairline divide-y">
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
                    <span className="text-content truncate text-sm">{member.displayName}</span>
                    {member.isYou ? (
                      <span className="text-2xs tracking-eyebrow text-content-subtle shrink-0 font-medium uppercase">
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
