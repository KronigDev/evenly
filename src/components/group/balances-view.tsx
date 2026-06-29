'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Confetti } from '@phosphor-icons/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Money } from '@/components/ui/money';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils/cn';
import type { BalancesDTO, GroupDTO, MemberDTO, TransferDTO } from '@/lib/api/types';
import { SettleDialog, type SettlePrefill } from './settle-dialog';
import { buildMemberMap, buildNetMap } from './queries';

export interface BalancesViewProps {
  group: GroupDTO;
  balances: BalancesDTO;
}

export function BalancesView({ group, balances }: BalancesViewProps) {
  const t = useTranslations('balances');
  const tc = useTranslations('common');
  const tg = useTranslations('groups');

  const [simplified, setSimplified] = useState(group.simplifyDebts);
  const [settleOpen, setSettleOpen] = useState(false);
  const [prefill, setPrefill] = useState<SettlePrefill | null>(null);

  const memberMap = useMemo(() => buildMemberMap(balances.members), [balances.members]);
  const netMap = useMemo(() => buildNetMap(balances.net), [balances.net]);
  const youId = group.yourMemberId;

  const transfers: TransferDTO[] = simplified ? balances.simplified : balances.pairwise;

  const netRows = useMemo(
    () =>
      [...balances.members]
        .map((member) => ({ member, net: netMap.get(member.id) ?? 0 }))
        .filter((row) => row.net !== 0)
        .sort((a, b) => b.net - a.net),
    [balances.members, netMap],
  );

  function memberName(id: string): string {
    return memberMap.get(id)?.displayName ?? tc('none');
  }

  function memberLike(id: string): MemberDTO {
    return (
      memberMap.get(id) ?? {
        id,
        displayName: tc('none'),
        role: 'MEMBER',
        status: 'LEFT',
        email: null,
        userId: null,
        image: null,
        isYou: false,
      }
    );
  }

  function startSettle(transfer: TransferDTO) {
    setPrefill({
      fromMemberId: transfer.fromMemberId,
      toMemberId: transfer.toMemberId,
      amount: transfer.amount,
    });
    setSettleOpen(true);
  }

  function transferLabel(transfer: TransferDTO) {
    const from = memberName(transfer.fromMemberId);
    const to = memberName(transfer.toMemberId);
    if (transfer.fromMemberId === youId) return t('youOwe', { name: to });
    if (transfer.toMemberId === youId) return t('owesYou', { name: from });
    return t('ownsTo', { from, to });
  }

  return (
    <div className="space-y-4">
      {/* Simplify toggle */}
      <div className="border-hairline bg-surface shadow-soft flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
        <div className="min-w-0">
          <p className="text-content text-sm font-medium">{t('simplifyToggle')}</p>
          <p className="text-content-muted text-xs">{tg('simplifyDebtsHint')}</p>
        </div>
        <Switch
          checked={simplified}
          onCheckedChange={setSimplified}
          aria-label={t('simplifyToggle')}
        />
      </div>

      {/* Net summary */}
      {netRows.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="border-hairline border-b px-4 py-2.5">
            <p className="eyebrow">{t('title')}</p>
          </div>
          <ul className="divide-hairline divide-y">
            {netRows.map(({ member, net }) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                <MemberAvatar member={member} size="sm" />
                <span className="text-content min-w-0 flex-1 truncate text-sm">
                  {member.displayName}
                  {member.isYou ? (
                    <span className="text-content-subtle"> · {tc('you')}</span>
                  ) : null}
                </span>
                <Money
                  cents={net}
                  currency={balances.currency}
                  colored
                  signed
                  className="text-sm font-medium"
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Transfers */}
      {transfers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Confetti size={26} />}
            title={t('allSettled')}
            description={t('allSettledBody')}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-hairline border-b px-4 py-2.5">
            <p className="eyebrow">{t('whoOwesWhom')}</p>
          </div>
          <ul className="divide-hairline divide-y">
            {transfers.map((transfer, index) => {
              const involvesYou = transfer.fromMemberId === youId || transfer.toMemberId === youId;
              return (
                <li
                  key={`${transfer.fromMemberId}-${transfer.toMemberId}-${index}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    involvesYou && 'bg-brand/[0.04]',
                  )}
                >
                  <div className="flex shrink-0 items-center -space-x-2">
                    <MemberAvatar member={memberLike(transfer.fromMemberId)} size="sm" />
                    <MemberAvatar member={memberLike(transfer.toMemberId)} size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm',
                        involvesYou ? 'text-content font-medium' : 'text-content',
                      )}
                    >
                      {transferLabel(transfer)}
                    </p>
                    <p className="text-content-subtle flex items-center gap-1 text-xs">
                      {memberName(transfer.fromMemberId)}
                      <ArrowRight size={11} aria-hidden="true" />
                      {memberName(transfer.toMemberId)}
                    </p>
                  </div>
                  <Money
                    cents={transfer.amount}
                    currency={balances.currency}
                    className={cn(
                      'text-sm font-semibold',
                      transfer.toMemberId === youId
                        ? 'text-positive'
                        : transfer.fromMemberId === youId
                          ? 'text-negative'
                          : 'text-content',
                    )}
                  />
                  <Button size="sm" variant="secondary" onClick={() => startSettle(transfer)}>
                    {t('settleUp')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <SettleDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        group={group}
        prefill={prefill}
      />
    </div>
  );
}
