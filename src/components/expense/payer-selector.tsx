'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UsersThree } from '@phosphor-icons/react';
import type { MemberDTO } from '@/lib/api/types';
import { sumCents } from '@/lib/money';
import { AmountInput } from '@/components/form/amount-input';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Money } from '@/components/ui/money';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/cn';

export interface PayerInput {
  memberId: string;
  amount: number;
}

export interface PayerSelectorProps {
  members: MemberDTO[];
  currency: string;
  totalMinor: number;
  /** The current user's member id, used as the default single payer. */
  currentMemberId: string | null;
  value: PayerInput[];
  onChange: (payers: PayerInput[]) => void;
}

/**
 * Who paid. Defaults to a single payer (the current user). A toggle reveals a
 * per-member amount editor with a live "remaining" indicator. Emits
 * `payers:[{memberId, amount}]` in entry-currency minor units.
 */
export function PayerSelector({
  members,
  currency,
  totalMinor,
  currentMemberId,
  value,
  onChange,
}: PayerSelectorProps) {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const ts = useTranslations('splits');

  const fallbackId = currentMemberId ?? members[0]?.id ?? '';

  const [multiple, setMultiple] = useState(() => value.length > 1);
  const [singleId, setSingleId] = useState(() => value[0]?.memberId ?? fallbackId);
  const [amounts, setAmounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const payer of value) initial[payer.memberId] = payer.amount;
    return initial;
  });

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Emit the canonical payer list whenever the relevant state changes.
  useEffect(() => {
    if (multiple) {
      const payers = members
        .map((member) => ({ memberId: member.id, amount: amounts[member.id] ?? 0 }))
        .filter((payer) => payer.amount > 0);
      onChangeRef.current(payers);
    } else {
      onChangeRef.current(singleId ? [{ memberId: singleId, amount: totalMinor }] : []);
    }
  }, [multiple, singleId, amounts, totalMinor, members]);

  function enableMultiple() {
    // Seed the editor so the current single payer holds the full total.
    setAmounts((prev) => {
      const next = { ...prev };
      if (singleId) next[singleId] = totalMinor;
      return next;
    });
    setMultiple(true);
  }

  function disableMultiple() {
    // Carry the largest contributor over to single mode.
    const top = members
      .map((member) => ({ id: member.id, amount: amounts[member.id] ?? 0 }))
      .sort((a, b) => b.amount - a.amount)[0];
    if (top && top.amount > 0) setSingleId(top.id);
    setMultiple(false);
  }

  const paidSum = sumCents(members.map((member) => amounts[member.id] ?? 0));
  const remaining = totalMinor - paidSum;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-content text-sm font-medium">{t('whoPaid')}</span>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <span className="text-content-muted inline-flex items-center gap-1.5 text-xs">
            <UsersThree size={15} aria-hidden="true" />
            {t('multiplePayers')}
          </span>
          <Switch
            checked={multiple}
            onCheckedChange={(checked) => (checked ? enableMultiple() : disableMultiple())}
            aria-label={t('multiplePayers')}
          />
        </label>
      </div>

      {multiple ? (
        <div className="space-y-1.5">
          <ul className="divide-hairline border-hairline bg-surface divide-y overflow-hidden rounded-xl border">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <MemberAvatar member={member} size="sm" />
                  <span className="text-content truncate text-sm">{member.displayName}</span>
                  {member.isYou ? (
                    <span className="text-2xs tracking-eyebrow text-content-subtle shrink-0 font-medium uppercase">
                      {tc('you')}
                    </span>
                  ) : null}
                </span>
                <AmountInput
                  valueMinor={amounts[member.id] ?? 0}
                  onChangeMinor={(minor) => setAmounts((prev) => ({ ...prev, [member.id]: minor }))}
                  currency={currency}
                  containerClassName="w-32"
                  aria-label={`${member.displayName} ${t('paidBy')}`}
                />
              </li>
            ))}
          </ul>
          <div
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
              remaining === 0 ? 'bg-positive/10 text-positive' : 'bg-surface-2 text-content-muted',
            )}
          >
            <span className="font-medium">{ts('remaining')}</span>
            <Money cents={remaining} currency={currency} colored={remaining !== 0} />
          </div>
        </div>
      ) : (
        <Select
          value={singleId}
          onChange={(event) => setSingleId(event.target.value)}
          aria-label={t('whoPaid')}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.isYou ? `${member.displayName} (${tc('you')})` : member.displayName}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
