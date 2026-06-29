'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, TrashSimple } from '@phosphor-icons/react';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { IconButton } from '@/components/ui/icon-button';
import { Money } from '@/components/ui/money';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api/client';
import { formatAmount, formatMoney, parseMoneyInput } from '@/lib/money';
import type { GroupDTO, SettlementDTO } from '@/lib/api/types';
import { ConfirmDialog } from './confirm-dialog';
import { buildMemberMap, groupKeys, useInvalidateGroup, useRelativeTime } from './queries';

export interface SettlePrefill {
  fromMemberId: string;
  toMemberId: string;
  amount: number; // base minor units
}

export interface SettleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupDTO;
  prefill?: SettlePrefill | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SettleDialog({ open, onOpenChange, group, prefill }: SettleDialogProps) {
  const t = useTranslations('settle');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale();
  const { toast } = useToast();
  const relative = useRelativeTime();
  const invalidateGroup = useInvalidateGroup(group.id);

  const activeMembers = useMemo(
    () => group.members.filter((member) => member.status !== 'LEFT'),
    [group.members],
  );
  const memberMap = useMemo(() => buildMemberMap(group.members), [group.members]);

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Seed the form whenever the dialog opens (honouring an optional prefill).
  useEffect(() => {
    if (!open) return;
    const fallbackFrom = prefill?.fromMemberId ?? group.yourMemberId ?? activeMembers[0]?.id ?? '';
    const fallbackTo =
      prefill?.toMemberId ?? activeMembers.find((member) => member.id !== fallbackFrom)?.id ?? '';
    setFromId(fallbackFrom);
    setToId(fallbackTo);
    setAmountText(prefill ? formatAmount(prefill.amount, group.baseCurrency, locale) : '');
    setDate(todayISO());
    setNote('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill]);

  const settlementsQuery = useQuery({
    queryKey: groupKeys.settlements(group.id),
    queryFn: ({ signal }) =>
      apiFetch<SettlementDTO[]>(`/api/groups/${group.id}/settlements`, { signal }),
    enabled: open,
  });

  const createSettlement = useMutation({
    mutationFn: (payload: {
      fromMemberId: string;
      toMemberId: string;
      amount: number;
      currency: string;
      date: string;
      note?: string;
    }) => apiFetch(`/api/groups/${group.id}/settlements`, { method: 'POST', body: payload }),
    onSuccess: async () => {
      toast.success(t('paymentRecorded'));
      await invalidateGroup();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : te('generic')),
  });

  const deleteSettlement = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/groups/${group.id}/settlements/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('deletePayment'));
      await invalidateGroup();
    },
  });

  function memberName(id: string): string {
    return memberMap.get(id)?.displayName ?? tc('none');
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromId || !toId) {
      setError(te('required'));
      return;
    }
    if (fromId === toId) {
      setError(t('paymentFrom') + ' ≠ ' + t('paymentTo'));
      return;
    }
    const amount = parseMoneyInput(amountText, group.baseCurrency);
    if (amount === null || amount <= 0) {
      setError(te('mustBePositive'));
      return;
    }
    setError(null);
    createSettlement.mutate({
      fromMemberId: fromId,
      toMemberId: toId,
      amount,
      currency: group.baseCurrency,
      date,
      note: note.trim() ? note.trim() : undefined,
    });
  }

  const settlements = settlementsQuery.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!createSettlement.isPending}
      aria-label={t('recordPayment')}
    >
      <DialogHeader
        title={t('recordPayment')}
        onClose={createSettlement.isPending ? undefined : () => onOpenChange(false)}
      />
      <DialogBody className="space-y-5">
        <form id="settle-form" onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <Field label={t('paymentFrom')}>
              <Select value={fromId} onChange={(event) => setFromId(event.target.value)}>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="hidden pb-2.5 text-content-subtle sm:block" aria-hidden="true">
              <ArrowRight size={18} />
            </div>
            <Field label={t('paymentTo')}>
              <Select value={toId} onChange={(event) => setToId(event.target.value)}>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label={t('howMuch')} error={error ?? undefined}>
            <Input
              inputMode="decimal"
              autoComplete="off"
              placeholder={formatMoney(0, group.baseCurrency, locale)}
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('paymentDate')}>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                max={todayISO()}
              />
            </Field>
            <Field label={t('paymentNote')}>
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('paymentNotePlaceholder')}
                maxLength={200}
              />
            </Field>
          </div>
        </form>

        {/* Settlement history */}
        <section className="space-y-2 border-t border-hairline pt-4">
          <p className="eyebrow">{t('settlementHistory')}</p>
          {settlementsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : settlements.length === 0 ? (
            <p className="py-2 text-sm text-content-subtle">{t('noSettlements')}</p>
          ) : (
            <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
              {settlements.map((settlement) => (
                <li key={settlement.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-content">
                      {memberName(settlement.fromMemberId)}
                      <ArrowRight
                        size={12}
                        className="mx-1 inline align-middle text-content-subtle"
                      />
                      {memberName(settlement.toMemberId)}
                    </p>
                    <p className="truncate text-xs text-content-subtle">
                      {relative(settlement.date)}
                      {settlement.note ? ` · ${settlement.note}` : ''}
                    </p>
                  </div>
                  <Money
                    cents={settlement.amount}
                    currency={settlement.currency}
                    className="text-sm font-medium text-content"
                  />
                  <IconButton
                    label={t('deletePayment')}
                    size="sm"
                    variant="ghost"
                    className="text-content-subtle hover:text-negative"
                    onClick={() => setDeleteId(settlement.id)}
                  >
                    <TrashSimple size={16} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={createSettlement.isPending}
        >
          {tc('cancel')}
        </Button>
        <Button type="submit" form="settle-form" loading={createSettlement.isPending}>
          {t('markAsPaid')}
        </Button>
      </DialogFooter>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(value) => {
          if (!value) setDeleteId(null);
        }}
        title={t('deletePayment')}
        description={t('deletePaymentConfirm')}
        confirmLabel={tc('delete')}
        danger
        onConfirm={async () => {
          if (deleteId) await deleteSettlement.mutateAsync(deleteId);
          setDeleteId(null);
        }}
      />
    </Dialog>
  );
}
