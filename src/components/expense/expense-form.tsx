'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import type { ExpenseDTO, GroupDTO, MemberDTO } from '@/lib/api/types';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { proportionalConvert, sumCents } from '@/lib/money';
import { SplitError, validatePayers } from '@/lib/split';
import { CurrencyAmountInput } from '@/components/form/amount-input';
import { PayerSelector, type PayerInput } from '@/components/expense/payer-selector';
import { RecurringFields, type RecurringInput } from '@/components/expense/recurring-fields';
import { ReceiptUploader } from '@/components/expense/receipt-uploader';
import {
  buildSplitPayload,
  computeSplitPreview,
  createInitialSplitState,
  SplitEditor,
  type SplitMemberState,
  type SplitMethod,
  type SplitState,
} from '@/components/expense/split-editor';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

export interface ExpenseFormProps {
  group: GroupDTO;
  members: MemberDTO[];
  mode: 'create' | 'edit';
  expense?: ExpenseDTO;
}

interface FormErrors {
  description?: string;
  amount?: string;
  payers?: string;
  split?: string;
  form?: string;
}

function todayString(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dateToIso(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

/** Rebuild form split state from a stored expense (used in edit mode). */
function reconstructSplitState(expense: ExpenseDTO, group: GroupDTO): SplitState {
  const members = group.members;
  const ids = members.map((member) => member.id);
  const sameCurrency = expense.currency === group.baseCurrency;
  let method = expense.splitMethod as SplitMethod;

  const base = createInitialSplitState(members, method);
  const next: Record<string, SplitMemberState> = {};
  for (const member of members) {
    const existing = base.members[member.id];
    next[member.id] = existing
      ? { ...existing }
      : { included: true, exact: 0, percent: 0, shares: 1, adjust: 0 };
  }

  const splitByMember = new Map(expense.splits.map((split) => [split.memberId, split]));
  const includedSet = new Set(expense.splits.map((split) => split.memberId));

  const owedBase = ids.map((id) => splitByMember.get(id)?.owedAmount ?? 0);
  const owedEntry = sameCurrency
    ? owedBase
    : proportionalConvert(owedBase, expense.amountBase, expense.amount);

  const assign = (id: string, patch: Partial<SplitMemberState>) => {
    next[id] = {
      ...(next[id] ?? { included: true, exact: 0, percent: 0, shares: 1, adjust: 0 }),
      ...patch,
    };
  };

  if (method === 'EQUAL') {
    for (const member of members) assign(member.id, { included: includedSet.has(member.id) });
  } else if (method === 'EXACT') {
    ids.forEach((id, index) => assign(id, { exact: owedEntry[index] ?? 0 }));
  } else if (method === 'PERCENTAGE') {
    for (const member of members) {
      assign(member.id, {
        percent: splitByMember.get(member.id)?.shareValue ?? 0,
        included: includedSet.has(member.id),
      });
    }
  } else if (method === 'SHARES') {
    for (const member of members) {
      assign(member.id, {
        shares: splitByMember.get(member.id)?.shareValue ?? 0,
        included: includedSet.has(member.id),
      });
    }
  } else if (method === 'ADJUSTMENT') {
    if (sameCurrency) {
      for (const member of members) {
        assign(member.id, {
          adjust: splitByMember.get(member.id)?.shareValue ?? 0,
          included: includedSet.has(member.id),
        });
      }
    } else {
      // Adjustments don't reconstruct cleanly across currencies — show as exact.
      method = 'EXACT';
      ids.forEach((id, index) => assign(id, { exact: owedEntry[index] ?? 0 }));
    }
  }

  let items = base.items;
  if (method === 'ITEMIZED' && expense.items.length > 0) {
    const itemBase = expense.items.map((item) => item.amount);
    const itemEntry = sameCurrency
      ? itemBase
      : proportionalConvert(itemBase, expense.amountBase, expense.amount);
    items = expense.items.map((item, index) => ({
      id: item.id,
      description: item.description,
      amount: itemEntry[index] ?? item.amount,
      memberIds: item.memberIds,
    }));
  }

  return { method, members: next, items };
}

function reconstructPayers(expense: ExpenseDTO, group: GroupDTO): PayerInput[] {
  const sameCurrency = expense.currency === group.baseCurrency;
  const base = expense.payers.map((payer) => payer.paidAmount);
  const entry = sameCurrency ? base : proportionalConvert(base, expense.amountBase, expense.amount);
  return expense.payers.map((payer, index) => ({
    memberId: payer.memberId,
    amount: entry[index] ?? payer.paidAmount,
  }));
}

export function ExpenseForm({ group, members, mode, expense }: ExpenseFormProps) {
  const t = useTranslations('expenses');
  const ts = useTranslations('splits');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const tCat = useTranslations('categories');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const youMemberId =
    group.yourMemberId ?? members.find((member) => member.isYou)?.id ?? members[0]?.id ?? null;

  const [description, setDescription] = useState(() => expense?.description ?? '');
  const [currency, setCurrency] = useState(() => expense?.currency ?? group.baseCurrency);
  const [totalMinor, setTotalMinor] = useState(() => expense?.amount ?? 0);
  const [category, setCategory] = useState(() => expense?.category ?? 'general');
  const [date, setDate] = useState(() => (expense ? expense.date.slice(0, 10) : todayString()));
  const [note, setNote] = useState(() => expense?.note ?? '');
  const [payers, setPayers] = useState<PayerInput[]>(() =>
    expense ? reconstructPayers(expense, group) : [],
  );
  const [splitState, setSplitState] = useState<SplitState>(() =>
    expense ? reconstructSplitState(expense, group) : createInitialSplitState(members),
  );
  const [recurring, setRecurring] = useState<RecurringInput | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handlePayersChange = useCallback((next: PayerInput[]) => setPayers(next), []);

  const itemized = splitState.method === 'ITEMIZED';
  // For itemized expenses the total is the items sum; read it straight from
  // state so submit never races the parent-total sync effect.
  const effectiveTotal = itemized
    ? sumCents(splitState.items.map((item) => item.amount))
    : totalMinor;
  const preview = computeSplitPreview(splitState, effectiveTotal);

  function includedCount(): number {
    return members.filter((member) => splitState.members[member.id]?.included ?? false).length;
  }

  const youOwed = preview.entries.find((entry) => entry.memberId === youMemberId)?.owedAmount ?? 0;
  const youPaid = sumCents(
    payers.filter((payer) => payer.memberId === youMemberId).map((payer) => payer.amount),
  );
  const youNet = youPaid - youOwed;

  function splitErrorMessage(code: string | undefined): string {
    switch (code) {
      case 'EXACT_MISMATCH':
        return ts('mustEqualTotal');
      case 'PERCENT_SUM':
      case 'NEGATIVE_PERCENT':
        return ts('doesntAddUp');
      case 'ZERO_SHARES':
      case 'NEGATIVE_SHARE':
      case 'NO_MEMBERS':
      case 'ITEM_NO_MEMBERS':
        return ts('selectAtLeastOne');
      default:
        return ts('doesntAddUp');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};

    const trimmedDescription = description.trim();
    if (trimmedDescription.length === 0) nextErrors.description = te('required');
    if (effectiveTotal <= 0) nextErrors.amount = te('mustBePositive');

    try {
      validatePayers(effectiveTotal, payers);
    } catch {
      nextErrors.payers = ts('mustEqualTotal');
    }

    if (!preview.ok) nextErrors.split = splitErrorMessage(preview.errorCode);
    if (
      (splitState.method === 'EQUAL' || splitState.method === 'ADJUSTMENT') &&
      includedCount() === 0
    ) {
      nextErrors.split = ts('selectAtLeastOne');
    }
    if (itemized && splitState.items.length === 0) nextErrors.split = ts('itemizedHint');

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(te('validation'));
      return;
    }
    setErrors({});

    const splitPayload = buildSplitPayload(splitState, splitState.method, effectiveTotal);
    const amount = splitPayload.amount ?? effectiveTotal;

    const body: Record<string, unknown> = {
      description: trimmedDescription,
      amount,
      currency,
      category,
      note: note.trim().length > 0 ? note.trim() : null,
      date: dateToIso(date),
      splitMethod: splitState.method,
      payers: payers.map((payer) => ({ memberId: payer.memberId, amount: payer.amount })),
    };
    if (splitPayload.splits) body.splits = splitPayload.splits;
    if (splitPayload.items) body.items = splitPayload.items;
    // Only send recurring when set, so editing doesn't clobber an existing rule.
    if (recurring) body.recurring = recurring;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await apiFetch<ExpenseDTO>(`/api/groups/${group.id}/expenses`, {
          method: 'POST',
          body,
        });
        if (stagedFiles.length > 0) {
          const failures = await uploadStagedFiles(created.id, stagedFiles);
          if (failures > 0) toast.error(te('network'));
        }
        toast.success(t('addedExpense'));
      } else if (expense) {
        await apiFetch(`/api/expenses/${expense.id}`, { method: 'PATCH', body });
        toast.success(t('savedExpense'));
      }

      queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      queryClient.invalidateQueries({ queryKey: ['expenses', group.id] });
      queryClient.invalidateQueries({ queryKey: ['balances', group.id] });
      router.push(`/groups/${group.id}`);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiClientError) {
        setErrors({ form: error.message });
        toast.error(error.message || te('generic'));
      } else if (error instanceof SplitError) {
        setErrors({ split: splitErrorMessage(error.code) });
        toast.error(te('validation'));
      } else {
        setErrors({ form: te('network') });
        toast.error(te('network'));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      {errors.form ? (
        <p
          role="alert"
          className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative"
        >
          {errors.form}
        </p>
      ) : null}

      <Field label={t('description')} error={errors.description} required>
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t('descriptionPlaceholder')}
          autoComplete="off"
          autoFocus
          className="h-12 text-base"
        />
      </Field>

      <Field
        label={t('amount')}
        error={errors.amount}
        required
        hint={itemized ? ts('itemizedHint') : undefined}
        htmlFor="expense-amount"
      >
        <CurrencyAmountInput
          id="expense-amount"
          valueMinor={totalMinor}
          onChangeMinor={setTotalMinor}
          currency={currency}
          onCurrencyChange={setCurrency}
          readOnly={itemized}
          invalid={Boolean(errors.amount)}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-2 block text-sm font-medium text-content">{tc('category')}</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {EXPENSE_CATEGORIES.map((meta) => {
            const active = meta.key === category;
            return (
              <button
                key={meta.key}
                type="button"
                onClick={() => setCategory(meta.key)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center outline-none transition-colors duration-150 ease-smooth focus-visible:ring-2 focus-visible:ring-brand/55',
                  active
                    ? 'border-brand bg-brand/[0.06]'
                    : 'border-hairline bg-surface hover:bg-surface-2',
                )}
              >
                <CategoryIcon category={meta.key} size="sm" />
                <span className="w-full truncate text-2xs text-content-muted">
                  {tCat(meta.key)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label={t('date')} required>
        <Input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="tabular w-full font-mono sm:w-56"
        />
      </Field>

      <section className="space-y-3 border-t border-hairline pt-6">
        <PayerSelector
          members={members}
          currency={currency}
          totalMinor={totalMinor}
          currentMemberId={youMemberId}
          value={payers}
          onChange={handlePayersChange}
        />
        {errors.payers ? <p className="text-xs text-negative">{errors.payers}</p> : null}
      </section>

      <section className="space-y-3 border-t border-hairline pt-6">
        <h2 className="text-sm font-medium text-content">{ts('howToSplit')}</h2>
        <SplitEditor
          members={members}
          currency={currency}
          totalMinor={totalMinor}
          value={splitState}
          onChange={setSplitState}
          onTotalChange={setTotalMinor}
        />
        {errors.split ? <p className="text-xs text-negative">{errors.split}</p> : null}
      </section>

      <Field label={t('notes')} htmlFor="expense-note">
        <Textarea
          id="expense-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('notesPlaceholder')}
        />
      </Field>

      <section className="space-y-2 border-t border-hairline pt-6">
        <h2 className="text-sm font-medium text-content">{t('receipt')}</h2>
        <ReceiptUploader
          mode={mode}
          expenseId={expense?.id}
          files={stagedFiles}
          onFilesChange={setStagedFiles}
          initialAttachments={expense?.attachments ?? []}
        />
      </section>

      <section className="border-t border-hairline pt-6">
        <RecurringFields value={recurring} onChange={setRecurring} />
      </section>

      {youMemberId && preview.ok ? (
        <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface-2/60 px-4 py-3">
          <span className="text-sm font-medium text-content">{t('yourShare')}</span>
          <span className="flex items-center gap-3">
            <Money cents={youOwed} currency={currency} className="text-content" />
            {youNet !== 0 ? (
              <Money cents={youNet} currency={currency} signed colored className="text-xs" />
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/groups/${group.id}`)}
          disabled={submitting}
        >
          {tc('cancel')}
        </Button>
        <Button type="submit" loading={submitting} className="sm:min-w-40">
          {mode === 'create' ? t('addExpense') : tc('saveChanges')}
        </Button>
      </div>
    </form>
  );
}

async function uploadStagedFiles(expenseId: string, files: File[]): Promise<number> {
  let failures = 0;
  for (const file of files) {
    try {
      const form = new FormData();
      form.append('file', file);
      await apiFetch(`/api/expenses/${expenseId}/attachments`, { method: 'POST', body: form });
    } catch {
      failures += 1;
    }
  }
  return failures;
}
